import type { CompanyScope } from "./firestore-repositories";
import { incrementDailyStats } from "./stats-daily";
import { logWebhookEvent } from "./webhook-log";
import type { NormalizedWebhookEvent } from "./whatsapp/types";

export async function processNormalizedWebhookEvents(
  events: NormalizedWebhookEvent[],
  scope: CompanyScope,
  meta?: { provider: string; connectionId?: string }
): Promise<void> {
  const provider = meta?.provider || "unknown";
  const connectionId = meta?.connectionId;

  if (events.length === 0) {
    await logWebhookEvent({
      companyId: scope.companyId,
      provider,
      eventType: "empty",
      status: "received",
      eventCount: 0,
    });
    return;
  }

  const {
    applyMessageReaction,
    blockContactByPhone,
    createOrGetContactByPhone,
    createOrGetConversationByPhone,
    findContactByPhone,
    isOptOutMessage,
    saveInboundMessage,
    saveOutboundMessage,
    updateMessageStatusByWhatsAppId,
  } = await import("./firestore-repositories");
  const { resolveWhatsAppMessageRef } = await import("./whatsapp-message-refs");
  const { resolveInboundReplyTo } = await import("./resolve-inbound-reply");

  for (const event of events) {
    try {
      if (event.type === "inbound_message") {
        if (event.kind === "reaction" && event.reaction) {
          const ref = await resolveWhatsAppMessageRef(
            event.reaction.targetWhatsappMessageId
          );
          if (ref && ref.companyId === scope.companyId) {
            await applyMessageReaction(
              ref.conversationId,
              ref.messageId,
              {
                emoji: event.reaction.emoji,
                from: "contact",
                whatsappMessageId: event.messageId,
              },
              scope
            );
          }

          await logWebhookEvent({
            companyId: scope.companyId,
            provider,
            eventType: "inbound_reaction",
            messageId: event.messageId,
            status: "processed",
          });
          continue;
        }

        // Dedup: a Meta reentrega webhooks; se a mensagem já foi salva
        // (ref por whatsappMessageId), ignora — mesmo padrão do outbound_sync.
        if (event.messageId) {
          const existing = await resolveWhatsAppMessageRef(event.messageId);
          if (existing) {
            await logWebhookEvent({
              companyId: scope.companyId,
              provider,
              eventType: "inbound_duplicate",
              phone: event.phone,
              messageId: event.messageId,
              status: "processed",
            });
            continue;
          }
        }

        console.log("[webhook] Mensagem inbound", {
          phone: event.phone,
          type: event.messageType,
          companyId: scope.companyId,
        });

        if (isOptOutMessage(event.body)) {
          console.log("[webhook] Opt-out detectado", event.phone);
          await blockContactByPhone(event.phone, scope);
          const contact = await findContactByPhone(event.phone, scope);
          if (contact) {
            const { cancelPendingJobsForContact } = await import("./campaign-queue");
            await cancelPendingJobsForContact(contact.id, scope);
          }
        }

        const contact = await createOrGetContactByPhone(event.phone, scope, {
          name: event.contactName || event.phone,
          source: "whatsapp",
        });

        const conversation = await createOrGetConversationByPhone(
          event.phone,
          contact.id,
          scope
        );

        if (connectionId) {
          const { updateConversationConnection } = await import(
            "./firestore-repositories"
          );
          await updateConversationConnection(conversation.id, connectionId);
        }

        const replyTo = await resolveInboundReplyTo(
          event,
          conversation.id,
          event.contactName || contact.name,
          scope
        );

        const saved = await saveInboundMessage({
          contactId: contact.id,
          conversationId: conversation.id,
          whatsappMessageId: event.messageId,
          type: event.messageType,
          body: event.body,
          media: event.media,
          replyTo,
          interactivePayload: event.interactivePayload,
          connectionId,
          rawPayload: event.raw,
        });

        const { mirrorEvolutionWebhookMedia } = await import("./evolution-media");
        const { mirrorInboundMedia } = await import("./inbound-media");
        const { updateConversationMessageMedia } = await import(
          "./firestore-repositories"
        );
        const mirroredMedia =
          provider === "evolution"
            ? await mirrorEvolutionWebhookMedia({
                companyId: scope.companyId,
                conversationId: conversation.id,
                messageId: saved.id,
                messageType: event.messageType,
                media: event.media,
                connectionId,
                whatsappMessageId: event.messageId,
                raw: event.raw,
              })
            : await mirrorInboundMedia({
                companyId: scope.companyId,
                conversationId: conversation.id,
                messageId: saved.id,
                messageType: event.messageType,
                media: event.media,
              });

        if (mirroredMedia?.storagePath) {
          await updateConversationMessageMedia(
            conversation.id,
            saved.id,
            mirroredMedia,
            scope
          );
        }

        const { tryAssignOnInbound } = await import("./lead-assignment");
        await tryAssignOnInbound(conversation.id, scope);

        await incrementDailyStats(scope.companyId, {
          messagesReceived: 1,
          optOuts: isOptOutMessage(event.body) ? 1 : 0,
        });

        await logWebhookEvent({
          companyId: scope.companyId,
          provider,
          eventType: "inbound_message",
          phone: event.phone,
          messageId: event.messageId,
          status: "processed",
        });
      }

      if (event.type === "outbound_sync") {
        const existing = await resolveWhatsAppMessageRef(event.messageId);
        if (existing) {
          continue;
        }

        console.log("[webhook] Mensagem outbound (celular)", {
          phone: event.phone,
          type: event.messageType,
          companyId: scope.companyId,
        });

        const contact = await createOrGetContactByPhone(event.phone, scope, {
          name: event.phone,
          source: "whatsapp",
        });

        const conversation = await createOrGetConversationByPhone(
          event.phone,
          contact.id,
          scope
        );

        if (connectionId) {
          const { updateConversationConnection } = await import(
            "./firestore-repositories"
          );
          await updateConversationConnection(conversation.id, connectionId);
        }

        const saved = await saveOutboundMessage({
          contactId: contact.id,
          conversationId: conversation.id,
          whatsappMessageId: event.messageId,
          type: event.messageType,
          body: event.body,
          media: event.media,
          status: "sent",
          connectionId,
          rawPayload: event.raw,
        });

        const { mirrorEvolutionWebhookMedia } = await import("./evolution-media");
        const { mirrorInboundMedia } = await import("./inbound-media");
        const { updateConversationMessageMedia } = await import(
          "./firestore-repositories"
        );
        const mirroredMedia =
          provider === "evolution"
            ? await mirrorEvolutionWebhookMedia({
                companyId: scope.companyId,
                conversationId: conversation.id,
                messageId: saved.id,
                messageType: event.messageType,
                media: event.media,
                connectionId,
                whatsappMessageId: event.messageId,
                raw: event.raw,
              })
            : await mirrorInboundMedia({
                companyId: scope.companyId,
                conversationId: conversation.id,
                messageId: saved.id,
                messageType: event.messageType,
                media: event.media,
              });

        if (mirroredMedia?.storagePath) {
          await updateConversationMessageMedia(
            conversation.id,
            saved.id,
            mirroredMedia,
            scope
          );
        }

        await logWebhookEvent({
          companyId: scope.companyId,
          provider,
          eventType: "outbound_sync",
          phone: event.phone,
          messageId: event.messageId,
          status: "processed",
        });
      }

      if (event.type === "status_update") {
        console.log("[webhook] Status update", {
          id: event.messageId,
          status: event.status,
          error: event.statusError,
        });
        try {
          await updateMessageStatusByWhatsAppId(
            event.messageId,
            event.status,
            event.statusError
          );
          try {
            const { updateCampaignJobMessageStatus } = await import("./campaign-queue");
            await updateCampaignJobMessageStatus(event.messageId, event.status);
            const { syncCampaignJobByWhatsappMessageId } = await import("./campaign-status-sync");
            await syncCampaignJobByWhatsappMessageId(event.messageId, event.status, scope);
          } catch (campaignError) {
            console.warn("[webhook] Falha ao atualizar job de campanha:", campaignError);
          }

          if (event.status === "delivered") {
            await incrementDailyStats(scope.companyId, { messagesDelivered: 1 });
          } else if (event.status === "read") {
            await incrementDailyStats(scope.companyId, { messagesRead: 1 });
          } else if (event.status === "failed") {
            await incrementDailyStats(scope.companyId, { messagesFailed: 1 });
          }

          await logWebhookEvent({
            companyId: scope.companyId,
            provider,
            eventType: "status_update",
            messageId: event.messageId,
            status: "processed",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro desconhecido";
          console.error("[webhook] Falha ao atualizar status (índice Firestore?):", error);
          await logWebhookEvent({
            companyId: scope.companyId,
            provider,
            eventType: "status_update",
            messageId: event.messageId,
            status: "error",
            error: message,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[webhook] Erro ao processar evento:", error);
      await logWebhookEvent({
        companyId: scope.companyId,
        provider,
        eventType: event.type,
        phone:
          event.type === "inbound_message" || event.type === "outbound_sync"
            ? event.phone
            : undefined,
        messageId: event.messageId,
        status: "error",
        error: message,
      });
    }
  }
}

/** @deprecated Use processNormalizedWebhookEvents */
export async function processWhatsAppWebhook(
  payload: unknown,
  scope: CompanyScope
): Promise<void> {
  const { MetaCloudProvider } = await import("./whatsapp/meta-cloud-provider");
  const { getWhatsAppConfig } = await import("./companies");
  const config = await getWhatsAppConfig(scope.companyId);
  const provider = new MetaCloudProvider(config);
  const events = provider.parseWebhook(payload);
  await processNormalizedWebhookEvents(events, scope, { provider: "meta" });
}
