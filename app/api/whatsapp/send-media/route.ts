export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { conversationWindowMessage } from "@/lib/conversation-window";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { assertCompanyMediaPath, getMediaSignedUrl } from "@/lib/media-storage";
import { incrementDailyStats } from "@/lib/stats-daily";
import { applySenderNameToOutboundBody, userChatSignatureName } from "@/lib/user-display";
import { messageSenderFromAuth } from "@/lib/user-profiles";
import { WhatsAppProviderError, extractMessageId, getWhatsAppProvider } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { sendMediaSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "conversations.reply");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = sendMediaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, type, storagePath, mimeType, caption, filename, retryMessageId, includeSenderName } =
      parsed.data;
    const phone = normalizePhone(to);
    const scope = { companyId: authResult.context.companyId };
    const senderName = authResult.context.auth
      ? userChatSignatureName(authResult.context.auth)
      : "";
    const outboundCaption =
      includeSenderName && caption?.trim() && senderName
        ? applySenderNameToOutboundBody(caption, senderName)
        : caption;

    assertCompanyMediaPath(storagePath, scope.companyId);

    const {
      createOrGetContactByPhone,
      createOrGetConversationByPhone,
      findContactByPhone,
      ensureConversationConnection,
      isConversationWindowOpen,
      saveOutboundMessage,
      updateMessageAfterResend,
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
      scope.companyId,
      conversation.connectionId
    );

    if (providerType === "meta_cloud") {
      const windowOpen = await isConversationWindowOpen(conversation.id, scope);
      if (!windowOpen) {
        return NextResponse.json(
          { error: conversationWindowMessage() },
          { status: 422 }
        );
      }
    }

    const signedUrl = await getMediaSignedUrl(storagePath).catch((error) => {
      console.warn("[send-media] Signed URL indisponível, usando storagePath:", error);
      return undefined;
    });

    const provider = await getWhatsAppProvider(
      scope.companyId,
      conversation.connectionId
    );
    const result = await provider.sendMedia({
      to: phone,
      type,
      storagePath,
      mediaUrl: signedUrl,
      mimeType,
      caption: outboundCaption,
      filename,
      skipAudioPrep: type === "audio" && /mpeg|mp3|ogg|opus/i.test(mimeType),
    });

    const bodyText =
      caption ||
      (type === "image" ? "[imagem]" : type === "audio" ? "[áudio]" : "[documento]");

    const whatsappId = result.messageId || extractMessageId(result.raw);

    if (retryMessageId) {
      await updateMessageAfterResend(conversation.id, retryMessageId, {
        whatsappMessageId: whatsappId,
        status: "accepted",
        rawPayload: result.raw,
      });
    } else {
      await saveOutboundMessage({
        contactId: contact.id,
        conversationId: conversation.id,
        whatsappMessageId: whatsappId,
        type,
        body: bodyText,
        status: "accepted",
        media: {
          storagePath,
          ...(signedUrl ? { url: signedUrl } : {}),
          mimeType,
          caption,
        },
        connectionId: conversation.connectionId,
        rawPayload: result.raw,
        ...messageSenderFromAuth(authResult.context.auth),
      });
    }

    await incrementDailyStats(scope.companyId, { messagesSent: 1 });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    if (error instanceof WhatsAppProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[send-media]", error);
    return NextResponse.json(
      { error: "Erro interno ao enviar mídia." },
      { status: 500 }
    );
  }
}
