import type { Message, MessageReplyPreview } from "./types";

const PREVIEW_MAX = 120;

function truncate(text: string, max = PREVIEW_MAX): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function displayBodyForMessage(message: Message): string {
  if (message.templateRenderedBody) {
    return truncate(message.templateRenderedBody);
  }
  if (message.type === "image") {
    return message.media?.caption?.trim() || "Foto";
  }
  if (message.type === "video") {
    return message.media?.caption?.trim() || "Vídeo";
  }
  if (message.type === "audio") {
    return "Áudio";
  }
  if (message.type === "document") {
    return message.body?.trim() || message.media?.caption?.trim() || "Documento";
  }
  if (message.type === "sticker") {
    return "Figurinha";
  }
  if (message.type === "template") {
    return truncate(message.body || `Template: ${message.templateName || ""}`);
  }
  return truncate(message.body || "");
}

export function buildReplyPreview(
  targetMessage: Message,
  senderLabel: string
): MessageReplyPreview {
  return {
    messageId: targetMessage.id,
    whatsappMessageId: targetMessage.whatsappMessageId,
    body: displayBodyForMessage(targetMessage),
    type: targetMessage.type,
    senderLabel,
    mediaStoragePath: targetMessage.media?.storagePath,
  };
}
