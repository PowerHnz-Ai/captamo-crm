import type { Message, MessageReaction } from "./types";
import type { CompanyScope } from "./firestore-repositories";
import { buildReplyPreview } from "./message-reply-preview";
import { parseMetaInboundMessage, type MetaInboundMessage } from "./whatsapp/meta-inbound-parse";

function isLegacyReactionPlaceholder(message: Message): boolean {
  return message.direction === "inbound" && message.body === "[reaction]";
}

function legacyReactionFromRaw(
  raw: unknown
): { emoji: string; targetWhatsappMessageId: string } | null {
  const parsed = parseMetaInboundMessage(raw as MetaInboundMessage);
  if (parsed.kind === "reaction" && parsed.reaction) {
    return parsed.reaction;
  }
  return null;
}

function legacyButtonBody(raw: unknown, body: string): string | null {
  if (body !== "[button]") return null;
  const parsed = parseMetaInboundMessage(raw as MetaInboundMessage);
  if (parsed.body && parsed.body !== "[button]") {
    return parsed.body;
  }
  return null;
}

export async function enrichConversationMessages(
  messages: Message[],
  scope: CompanyScope,
  contactName: string
): Promise<Message[]> {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const byWhatsappId = new Map(
    messages
      .filter((message) => message.whatsappMessageId)
      .map((message) => [message.whatsappMessageId!, message])
  );

  const hiddenIds = new Set<string>();
  const pendingReactions: Array<{
    targetWhatsappMessageId: string;
    reaction: MessageReaction;
  }> = [];

  const enriched = messages.map((message) => {
    let next: Message = { ...message };

    if (isLegacyReactionPlaceholder(message) && message.rawPayload) {
      const legacy = legacyReactionFromRaw(message.rawPayload);
      if (legacy) {
        hiddenIds.add(message.id);
        pendingReactions.push({
          targetWhatsappMessageId: legacy.targetWhatsappMessageId,
          reaction: {
            emoji: legacy.emoji,
            from: "contact",
            whatsappMessageId: message.whatsappMessageId,
          },
        });
        return next;
      }
    }

    if (message.body === "[button]" && message.rawPayload) {
      const fixedBody = legacyButtonBody(message.rawPayload, message.body);
      if (fixedBody) {
        next = { ...next, body: fixedBody, type: "text" };
      }
      const contextId = (message.rawPayload as { context?: { id?: string } }).context
        ?.id;
      if (contextId && !next.replyTo) {
        next = {
          ...next,
          replyTo: { whatsappMessageId: contextId, body: "", senderLabel: "Você" },
        };
      }
    }

    return next;
  });

  for (const pending of pendingReactions) {
    const target =
      byWhatsappId.get(pending.targetWhatsappMessageId) ||
      enriched.find(
        (message) => message.whatsappMessageId === pending.targetWhatsappMessageId
      );
    if (!target || hiddenIds.has(target.id)) continue;

    const reactions = [...(target.reactions || [])];
    const index = reactions.findIndex((item) => item.from === "contact");
    if (index >= 0) {
      reactions[index] = pending.reaction;
    } else {
      reactions.push(pending.reaction);
    }
    byId.set(target.id, { ...target, reactions });
  }

  const { resolveWhatsAppMessageRef } = await import("./whatsapp-message-refs");
  const { getConversationMessage } = await import("./firestore-repositories");
  const { getTemplateByName } = await import("./template-repositories");

  for (const message of enriched) {
    if (hiddenIds.has(message.id)) continue;

    let current = byId.get(message.id) || message;

    if (
      current.type === "template" &&
      current.templateName &&
      !current.templateButtons?.length
    ) {
      const template = await getTemplateByName(current.templateName, scope);
      if (template?.buttons?.length) {
        current = { ...current, templateButtons: template.buttons };
        byId.set(message.id, current);
      }
    }

    if (current.replyTo?.body?.trim()) {
      byId.set(message.id, current);
      continue;
    }

    const replyWhatsappId =
      current.replyTo?.whatsappMessageId ||
      (current.rawPayload as { context?: { id?: string } } | undefined)?.context?.id;

    if (!replyWhatsappId) {
      byId.set(message.id, current);
      continue;
    }

    let target =
      byWhatsappId.get(replyWhatsappId) ||
      enriched.find((item) => item.whatsappMessageId === replyWhatsappId);

    if (!target) {
      const ref = await resolveWhatsAppMessageRef(replyWhatsappId);
      if (ref && ref.conversationId === message.conversationId) {
        const loaded = await getConversationMessage(
          ref.conversationId,
          ref.messageId,
          scope
        );
        if (loaded) target = loaded;
      }
    }

    const senderLabel =
      target?.direction === "outbound" ? "Você" : contactName || "Contato";

    byId.set(message.id, {
      ...current,
      replyTo: target
        ? buildReplyPreview(target, senderLabel)
        : {
            whatsappMessageId: replyWhatsappId,
            body: "Mensagem",
            senderLabel,
          },
    });
  }

  return enriched
    .filter((message) => !hiddenIds.has(message.id))
    .map((message) => byId.get(message.id) || message);
}
