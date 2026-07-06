export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { conversationWindowMessage } from "@/lib/conversation-window";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { uploadCompanyMedia } from "@/lib/media-storage";
import { incrementDailyStats } from "@/lib/stats-daily";
import { messageSenderFromAuth } from "@/lib/user-profiles";
import {
  isWhatsAppReadyAudio,
  prepareOutboundAudio,
} from "@/lib/audio-transcode";
import {
  WhatsAppNotConfiguredError,
  WhatsAppProviderError,
  extractMessageId,
  getWhatsAppProvider,
} from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/whatsapp/phone";

/** Upload + envio Meta em uma única requisição (evita falha entre upload e send-media). */
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
    const formData = await request.formData();
    const file = formData.get("file");
    const conversationId = String(formData.get("conversationId") || "");
    const to = String(formData.get("to") || "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }
    if (!conversationId || !to) {
      return NextResponse.json(
        { error: "conversationId e to são obrigatórios." },
        { status: 400 }
      );
    }

    const mimeType = file.type || "audio/webm";
    if (!mimeType.startsWith("audio/")) {
      return NextResponse.json({ error: "Arquivo não é áudio." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 400) {
      return NextResponse.json(
        { error: "Gravação muito curta ou vazia. Grave por mais de 1 segundo." },
        { status: 422 }
      );
    }

    let prepared;
    try {
      prepared = await prepareOutboundAudio(buffer, mimeType);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao converter áudio.";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    if (!isWhatsAppReadyAudio(prepared.mimeType)) {
      return NextResponse.json(
        { error: "Formato de áudio não suportado pelo WhatsApp." },
        { status: 422 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const phone = normalizePhone(to);

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

    if (conversation.id !== conversationId) {
      return NextResponse.json(
        { error: "Conversa não corresponde ao destinatário." },
        { status: 400 }
      );
    }

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

    const audioBuffer = Buffer.from(prepared.buffer);
    const outboundMime = prepared.mimeType;
    const outboundName = prepared.filename;
    const uploaded = await uploadCompanyMedia({
      companyId: scope.companyId,
      conversationId,
      buffer: audioBuffer,
      mimeType: outboundMime,
      filename: outboundName,
    });

    const provider = await getWhatsAppProvider(
      scope.companyId,
      conversation.connectionId
    );
    const result = await provider.sendMedia({
      to: phone,
      type: "audio",
      storagePath: uploaded.storagePath,
      mediaUrl: uploaded.signedUrl,
      mimeType: outboundMime,
      filename: outboundName,
      preparedBuffer: audioBuffer,
      skipAudioPrep: true,
    });

    const whatsappId = result.messageId || extractMessageId(result.raw);
    if (!whatsappId) {
      console.error("[send-audio] Meta não retornou message id:", result.raw);
      return NextResponse.json(
        { error: "WhatsApp aceitou o envio mas não retornou ID da mensagem." },
        { status: 502 }
      );
    }

    await saveOutboundMessage({
      contactId: contact.id,
      conversationId: conversation.id,
      whatsappMessageId: whatsappId,
      type: "audio",
      body: "[áudio]",
      status: "accepted",
      media: {
        storagePath: uploaded.storagePath,
        ...(uploaded.signedUrl ? { url: uploaded.signedUrl } : {}),
        mimeType: outboundMime,
      },
      connectionId: conversation.connectionId,
      rawPayload: result.raw,
      ...messageSenderFromAuth(authResult.context.auth),
    });

    await incrementDailyStats(scope.companyId, { messagesSent: 1 });

    return NextResponse.json({
      success: true,
      messageId: whatsappId,
      storagePath: uploaded.storagePath,
      mimeType: outboundMime,
    });
  } catch (error) {
    if (error instanceof WhatsAppNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof WhatsAppProviderError) {
      console.error("[send-audio] Meta:", error.message, error.details);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[send-audio]", error);
    return NextResponse.json(
      { error: "Erro interno ao enviar áudio." },
      { status: 500 }
    );
  }
}
