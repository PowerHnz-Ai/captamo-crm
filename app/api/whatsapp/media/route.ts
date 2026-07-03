export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { canReadConversationContent } from "@/lib/permissions";
import {
  assertCompanyMediaPath,
  downloadStorageMedia,
  getMediaSignedUrl,
} from "@/lib/media-storage";
import {
  fetchCompanyMetaMedia,
  isMetaMediaId,
  normalizeAudioMimeType,
} from "@/lib/meta-media";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!canReadConversationContent(authResult.context.auth!)) {
    return NextResponse.json(
      { error: "Sem permissão para acessar mídia." },
      { status: 403 }
    );
  }

  try {
    const storagePath = request.nextUrl.searchParams.get("storagePath");
    const conversationId = request.nextUrl.searchParams.get("conversationId");
    const messageId = request.nextUrl.searchParams.get("messageId");
    const redirect = request.nextUrl.searchParams.get("redirect") === "true";

    const scope = { companyId: authResult.context.companyId };
    let resolvedPath = storagePath || "";
    let message:
      | Awaited<
          ReturnType<
            typeof import("@/lib/firestore-repositories").getConversationMessage
          >
        >
      | null = null;

    if (!resolvedPath && conversationId && messageId) {
      const { getConversationMessage } = await import("@/lib/firestore-repositories");
      message = await getConversationMessage(conversationId, messageId, scope);
      if (message?.media?.storagePath) {
        resolvedPath = message.media.storagePath;
      }
    }

    if (!resolvedPath) {
      const metaMediaId =
        message?.media?.url && isMetaMediaId(message.media.url)
          ? message.media.url
          : null;

      if (metaMediaId && conversationId && messageId) {
        const { buffer, mimeType } = await fetchCompanyMetaMedia(
          scope.companyId,
          metaMediaId
        );
        const contentType = normalizeAudioMimeType(
          mimeType || message?.media?.mimeType || "application/octet-stream"
        );

        void cacheInboundMetaMedia({
          companyId: scope.companyId,
          conversationId,
          messageId,
          messageType: message?.type || "audio",
          mediaId: metaMediaId,
          existingMedia: message?.media,
        });

        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=3600",
          },
        });
      }

      if (conversationId && messageId && message) {
        const { getConversationById } = await import("@/lib/firestore-repositories");
        const conversation = await getConversationById(conversationId, scope);
        const mediaTypes = new Set([
          "audio",
          "image",
          "video",
          "document",
          "sticker",
        ]);

        if (
          mediaTypes.has(message.type) &&
          message.whatsappMessageId &&
          conversation?.connectionId
        ) {
          const phoneDigits = (conversation.phone || "").replace(/\D/g, "");
          const remoteJid = phoneDigits
            ? `${phoneDigits}@s.whatsapp.net`
            : undefined;

          const { tryLazyEvolutionMedia } = await import("@/lib/evolution-media");
          const lazy = await tryLazyEvolutionMedia({
            companyId: scope.companyId,
            conversationId,
            messageId,
            messageType: message.type,
            whatsappMessageId: message.whatsappMessageId,
            connectionId: conversation.connectionId,
            media: message.media,
            rawPayload: message.rawPayload,
            remoteJid,
            fromMe: message.direction === "outbound",
          });

          if (lazy) {
            const contentType = lazy.mimeType.startsWith("audio/")
              ? normalizeAudioMimeType(lazy.mimeType)
              : lazy.mimeType;

            return new NextResponse(new Uint8Array(lazy.buffer), {
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "private, max-age=3600",
              },
            });
          }
        }
      }

      if (!conversationId || !messageId) {
        return NextResponse.json(
          { error: "Informe storagePath ou conversationId+messageId." },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
    }

    assertCompanyMediaPath(resolvedPath, scope.companyId);

    if (redirect) {
      const signedUrl = await getMediaSignedUrl(resolvedPath);
      return NextResponse.redirect(signedUrl);
    }

    const { buffer, mimeType } = await downloadStorageMedia(resolvedPath);
    const contentType = mimeType.startsWith("audio/")
      ? normalizeAudioMimeType(mimeType)
      : mimeType;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[whatsapp/media]", error);
    return NextResponse.json({ error: "Erro ao carregar mídia." }, { status: 500 });
  }
}

async function cacheInboundMetaMedia(params: {
  companyId: string;
  conversationId: string;
  messageId: string;
  messageType: string;
  mediaId: string;
  existingMedia?: { url?: string; mimeType?: string; caption?: string };
}) {
  try {
    const { mirrorInboundMedia } = await import("@/lib/inbound-media");
    const { updateConversationMessageMedia } = await import(
      "@/lib/firestore-repositories"
    );

    const mirrored = await mirrorInboundMedia({
      companyId: params.companyId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      messageType: params.messageType,
      media: {
        ...params.existingMedia,
        url: params.mediaId,
      },
    });

    if (mirrored?.storagePath) {
      await updateConversationMessageMedia(
        params.conversationId,
        params.messageId,
        mirrored,
        { companyId: params.companyId }
      );
    }
  } catch (error) {
    console.error("[whatsapp/media] Falha ao cachear mídia Meta:", error);
  }
}
