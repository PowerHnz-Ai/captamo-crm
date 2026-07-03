export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { conversationWindowMessage } from "@/lib/conversation-window";
import { resolveCompanyContext } from "@/lib/request-company";
import { incrementDailyStats } from "@/lib/stats-daily";
import { applySenderNameToOutboundBody, userChatSignatureName } from "@/lib/user-display";
import { messageSenderFromAuth } from "@/lib/user-profiles";
import { WhatsAppProviderError, extractMessageId } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { sendTextSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = sendTextSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, body: textBody, includeSenderName } = parsed.data;
    const phone = normalizePhone(to);
    const scope = { companyId: context.companyId };
    const senderName = context.auth ? userChatSignatureName(context.auth) : "";
    const outboundBody =
      includeSenderName && senderName
        ? applySenderNameToOutboundBody(textBody, senderName)
        : textBody;

    const {
      createOrGetContactByPhone,
      createOrGetConversationByPhone,
      findContactByPhone,
      ensureConversationConnection,
      isConversationWindowOpen,
      saveOutboundMessage,
    } = await import("@/lib/firestore-repositories");

    const existing = await findContactByPhone(phone, scope);
    if (existing?.blocked) {
      return NextResponse.json(
        { error: "Contato bloqueado. Não é possível enviar mensagens." },
        { status: 403 }
      );
    }

    const contact = await createOrGetContactByPhone(phone, scope, {
      name: existing?.name || phone,
      source: existing?.source || "whatsapp",
    });

    let conversation = await createOrGetConversationByPhone(
      phone,
      contact.id,
      scope
    );
    conversation = await ensureConversationConnection(conversation, scope);

    const { getConnectionProvider } = await import("@/lib/connections");
    const providerType = await getConnectionProvider(
      context.companyId,
      conversation.connectionId
    );

    // Janela de 24h só se aplica à API oficial da Meta.
    if (providerType === "meta_cloud") {
      const windowOpen = await isConversationWindowOpen(conversation.id, scope);
      if (!windowOpen) {
        return NextResponse.json(
          { error: conversationWindowMessage() },
          { status: 422 }
        );
      }
    }

    const provider = await getWhatsAppProvider(
      context.companyId,
      conversation.connectionId
    );
    const result = await provider.sendText({ to: phone, body: outboundBody });

    await saveOutboundMessage({
      contactId: contact.id,
      conversationId: conversation.id,
      whatsappMessageId: result.messageId || extractMessageId(result.raw),
      type: "text",
      body: textBody,
      status: "accepted",
      connectionId: conversation.connectionId,
      rawPayload: result.raw,
      ...messageSenderFromAuth(context.auth),
    });

    await incrementDailyStats(context.companyId, { messagesSent: 1 });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    if (error instanceof WhatsAppProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[send-text]", error);
    return NextResponse.json(
      { error: "Erro interno ao enviar mensagem de texto." },
      { status: 500 }
    );
  }
}
