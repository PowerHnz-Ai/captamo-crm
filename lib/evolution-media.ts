import type { MessageMedia } from "./types";
import { mirrorInboundMedia } from "./inbound-media";
import { uploadCompanyMedia } from "./media-storage";
import {
  EvolutionProvider,
  extractEvolutionMessageKeyFromWebhook,
  type EvolutionMediaMessageKey,
} from "./whatsapp/evolution-provider";
import { connectionToWhatsAppConfig, getConnection } from "./connections";

function extensionForMime(mimeType: string, messageType: string): string {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("pdf")) return "pdf";
  if (messageType === "video") return "mp4";
  if (messageType === "audio") return "ogg";
  if (messageType === "image" || messageType === "sticker") return "jpg";
  return "bin";
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isWhatsAppEncryptedMediaUrl(url?: string): boolean {
  if (!url) return false;
  return url.includes("mmg.whatsapp.net") || url.includes(".enc");
}

function decodeDataUri(url: string): { buffer: Buffer; mimeType: string } | null {
  if (!url.startsWith("data:")) return null;
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2]!, "base64"),
  };
}

async function uploadMirroredMedia(params: {
  companyId: string;
  conversationId: string;
  messageId: string;
  messageType: string;
  media?: MessageMedia;
  buffer: Buffer;
  mimeType: string;
}): Promise<MessageMedia | undefined> {
  const ext = extensionForMime(params.mimeType, params.messageType);
  const uploaded = await uploadCompanyMedia({
    companyId: params.companyId,
    conversationId: params.conversationId,
    messageId: params.messageId,
    buffer: params.buffer,
    mimeType: params.mimeType,
    filename: `inbound.${ext}`,
  });

  return {
    ...params.media,
    storagePath: uploaded.storagePath,
    url: uploaded.signedUrl,
    mimeType: params.mimeType,
  };
}

export async function resolveEvolutionInstanceId(
  companyId: string,
  connectionId?: string
): Promise<string | undefined> {
  if (!connectionId) return undefined;
  const connection = await getConnection(companyId, connectionId);
  return connection?.instanceId;
}

async function downloadViaEvolution(params: {
  companyId: string;
  connectionId?: string;
  instanceId?: string;
  messageKey: EvolutionMediaMessageKey;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const instanceId =
    params.instanceId ||
    (await resolveEvolutionInstanceId(params.companyId, params.connectionId));

  if (!instanceId) return null;

  const connection = params.connectionId
    ? await getConnection(params.companyId, params.connectionId)
    : null;

  const provider = new EvolutionProvider(
    connection
      ? connectionToWhatsAppConfig(connection)
      : {
          provider: "evolution",
          companyId: params.companyId,
          instanceId,
        }
  );

  try {
    return await provider.downloadMediaMessage(instanceId, params.messageKey);
  } catch (error) {
    console.error("[evolution-media] Falha ao baixar mídia na Evolution:", error);
    return null;
  }
}

export async function mirrorEvolutionWebhookMedia(params: {
  companyId: string;
  conversationId: string;
  messageId: string;
  messageType: string;
  media?: MessageMedia;
  instanceId?: string;
  connectionId?: string;
  messageKey?: EvolutionMediaMessageKey | null;
  whatsappMessageId?: string;
  raw?: unknown;
  remoteJid?: string;
  fromMe?: boolean;
}): Promise<MessageMedia | undefined> {
  const { media, companyId, conversationId, messageId, messageType } = params;

  if (media?.storagePath) return media;

  if (media?.url?.startsWith("data:")) {
    const decoded = decodeDataUri(media.url);
    if (decoded) {
      try {
        return await uploadMirroredMedia({
          companyId,
          conversationId,
          messageId,
          messageType,
          media,
          buffer: decoded.buffer,
          mimeType: decoded.mimeType,
        });
      } catch (error) {
        console.error("[evolution-media] Falha ao salvar data URI:", error);
      }
    }
  }

  const shouldSkipHttpMirror =
    !media?.url || isWhatsAppEncryptedMediaUrl(media.url);

  if (!shouldSkipHttpMirror && isHttpUrl(media.url!)) {
    const mirrored = await mirrorInboundMedia({
      companyId,
      conversationId,
      messageId,
      messageType,
      media,
    });
    if (mirrored?.storagePath) return mirrored;
  }

  const messageKey =
    params.messageKey ||
    (params.raw && params.whatsappMessageId
      ? extractEvolutionMessageKeyFromWebhook(params.raw, params.whatsappMessageId)
      : null) ||
    (params.whatsappMessageId && params.remoteJid
      ? {
          id: params.whatsappMessageId,
          remoteJid: params.remoteJid,
          fromMe: params.fromMe,
        }
      : null);

  if (!messageKey?.id) return media;

  const downloaded = await downloadViaEvolution({
    companyId,
    connectionId: params.connectionId,
    instanceId: params.instanceId,
    messageKey,
  });

  if (!downloaded) return media;

  try {
    return await uploadMirroredMedia({
      companyId,
      conversationId,
      messageId,
      messageType,
      media,
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType || media?.mimeType || "audio/ogg",
    });
  } catch (error) {
    console.error("[evolution-media] Falha ao espelhar mídia Evolution:", error);
    return media;
  }
}

export async function tryLazyEvolutionMedia(params: {
  companyId: string;
  conversationId: string;
  messageId: string;
  messageType: string;
  whatsappMessageId?: string;
  connectionId?: string;
  media?: MessageMedia;
  rawPayload?: unknown;
  remoteJid?: string;
  fromMe?: boolean;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const mirrored = await mirrorEvolutionWebhookMedia({
    companyId: params.companyId,
    conversationId: params.conversationId,
    messageId: params.messageId,
    messageType: params.messageType,
    media: params.media,
    connectionId: params.connectionId,
    whatsappMessageId: params.whatsappMessageId,
    raw: params.rawPayload,
    remoteJid: params.remoteJid,
    fromMe: params.fromMe,
  });

  if (!mirrored?.storagePath) return null;

  const { updateConversationMessageMedia } = await import("./firestore-repositories");
  await updateConversationMessageMedia(
    params.conversationId,
    params.messageId,
    mirrored,
    { companyId: params.companyId }
  );

  const { downloadStorageMedia } = await import("./media-storage");
  return downloadStorageMedia(mirrored.storagePath);
}
