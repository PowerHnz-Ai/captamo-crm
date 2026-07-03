import type { MessageType } from "../types";
import type { MessageMedia } from "./types";

export interface MetaInboundMessage {
  id: string;
  from: string;
  type: string;
  timestamp?: string;
  context?: { from?: string; id?: string };
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  reaction?: { message_id?: string; emoji?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  audio?: { id?: string; mime_type?: string };
  document?: {
    id?: string;
    caption?: string;
    mime_type?: string;
    filename?: string;
  };
  video?: { id?: string; caption?: string; mime_type?: string };
  sticker?: { id?: string; mime_type?: string };
}

export interface ParsedMetaInbound {
  body: string;
  messageType: MessageType;
  media?: MessageMedia;
  kind: "message" | "reaction";
  reaction?: { emoji: string; targetWhatsappMessageId: string };
  replyToWhatsappMessageId?: string;
  interactivePayload?: string;
}

function mapMessageType(type: string): MessageType {
  if (type === "voice" || type === "ptt") return "audio";
  const allowed: MessageType[] = [
    "text",
    "template",
    "image",
    "audio",
    "document",
    "video",
    "sticker",
  ];
  return allowed.includes(type as MessageType) ? (type as MessageType) : "unknown";
}

export function parseMetaInboundMessage(message: MetaInboundMessage): ParsedMetaInbound {
  if (message.type === "reaction" && message.reaction?.message_id) {
    return {
      body: "",
      messageType: "unknown",
      kind: "reaction",
      reaction: {
        emoji: message.reaction.emoji ?? "",
        targetWhatsappMessageId: message.reaction.message_id,
      },
    };
  }

  if (message.type === "button" && message.button) {
    return {
      body: message.button.text || message.button.payload || "[botão]",
      messageType: "text",
      kind: "message",
      replyToWhatsappMessageId: message.context?.id,
      interactivePayload: message.button.payload,
    };
  }

  if (message.type === "interactive" && message.interactive) {
    const interactive = message.interactive;
    if (interactive.type === "button_reply" && interactive.button_reply) {
      return {
        body: interactive.button_reply.title || interactive.button_reply.id || "[botão]",
        messageType: "text",
        kind: "message",
        replyToWhatsappMessageId: message.context?.id,
        interactivePayload: interactive.button_reply.id,
      };
    }
    if (interactive.type === "list_reply" && interactive.list_reply) {
      return {
        body: interactive.list_reply.title || interactive.list_reply.id || "[lista]",
        messageType: "text",
        kind: "message",
        replyToWhatsappMessageId: message.context?.id,
        interactivePayload: interactive.list_reply.id,
      };
    }
  }

  let body = `[${message.type}]`;
  let media: MessageMedia | undefined;
  let messageType = mapMessageType(message.type);
  const replyToWhatsappMessageId = message.context?.id;

  if (message.type === "text" && message.text?.body) {
    body = message.text.body;
    messageType = "text";
  } else if (message.type === "image" && message.image) {
    body = message.image.caption || "[imagem]";
    messageType = "image";
    media = {
      url: message.image.id,
      mimeType: message.image.mime_type,
      caption: message.image.caption,
    };
  } else if (
    (message.type === "audio" || message.type === "voice") &&
    message.audio
  ) {
    body = "[áudio]";
    messageType = "audio";
    media = {
      url: message.audio.id,
      mimeType: message.audio.mime_type || "audio/ogg",
    };
  } else if (message.type === "document" && message.document) {
    body =
      message.document.caption ||
      message.document.filename ||
      "[documento]";
    messageType = "document";
    media = {
      url: message.document.id,
      mimeType: message.document.mime_type,
      caption: message.document.caption,
    };
  } else if (message.type === "video" && message.video) {
    body = message.video.caption || "[vídeo]";
    messageType = "video";
    media = {
      url: message.video.id,
      mimeType: message.video.mime_type || "video/mp4",
      caption: message.video.caption,
    };
  } else if (message.type === "sticker" && message.sticker) {
    body = "[figurinha]";
    messageType = "sticker";
    media = {
      url: message.sticker.id,
      mimeType: message.sticker.mime_type || "image/webp",
    };
  }

  return {
    body,
    messageType,
    media,
    kind: "message",
    replyToWhatsappMessageId,
  };
}
