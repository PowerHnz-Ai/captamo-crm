import type { MessageMedia } from "./types";
import {
  downloadRemoteMedia,
  uploadCompanyMedia,
} from "./media-storage";
import { fetchCompanyMetaMedia, isMetaMediaId } from "./meta-media";
import { getWhatsAppConfig } from "./companies";

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

export async function mirrorInboundMedia(params: {
  companyId: string;
  conversationId: string;
  messageId: string;
  messageType: string;
  media?: MessageMedia;
}): Promise<MessageMedia | undefined> {
  const { media, companyId, conversationId, messageId, messageType } = params;
  if (!media?.url && !media?.storagePath) return media;
  if (media.storagePath) return media;

  const config = await getWhatsAppConfig(companyId);
  let buffer: Buffer;
  let mimeType = media.mimeType || "application/octet-stream";

  try {
    if (config.provider === "meta_cloud" && isMetaMediaId(media.url)) {
      const downloaded = await fetchCompanyMetaMedia(companyId, media.url!);
      buffer = downloaded.buffer;
      mimeType = downloaded.mimeType || mimeType;
    } else if (isHttpUrl(media.url!)) {
      const downloaded = await downloadRemoteMedia(media.url!);
      buffer = downloaded.buffer;
      mimeType = downloaded.mimeType || mimeType;
    } else {
      return media;
    }

    const ext = extensionForMime(mimeType, messageType);
    const uploaded = await uploadCompanyMedia({
      companyId,
      conversationId,
      messageId,
      buffer,
      mimeType,
      filename: `inbound.${ext}`,
    });

    return {
      ...media,
      storagePath: uploaded.storagePath,
      url: uploaded.signedUrl,
      mimeType,
    };
  } catch (error) {
    console.error("[inbound-media] Falha ao espelhar mídia:", error);
    return media;
  }
}
