export function buildMediaProxyUrl(params: {
  conversationId: string;
  messageId: string;
  storagePath?: string;
}): string {
  const search = new URLSearchParams();
  if (params.storagePath) {
    search.set("storagePath", params.storagePath);
  } else {
    search.set("conversationId", params.conversationId);
    search.set("messageId", params.messageId);
  }
  return `/api/whatsapp/media?${search.toString()}`;
}

export function resolveMessageMediaUrl(
  message: { id: string; conversationId: string; media?: { url?: string; storagePath?: string } }
): string | null {
  if (message.media?.storagePath) {
    return buildMediaProxyUrl({
      conversationId: message.conversationId,
      messageId: message.id,
      storagePath: message.media.storagePath,
    });
  }
  if (message.media?.url?.startsWith("blob:")) {
    return message.media.url;
  }
  if (message.media?.url && /^https?:\/\//i.test(message.media.url)) {
    return message.media.url;
  }
  if (message.media?.url) {
    return buildMediaProxyUrl({
      conversationId: message.conversationId,
      messageId: message.id,
    });
  }
  return null;
}

export function mediaKindFromMime(mimeType: string): "image" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export function firstNameFromFullName(name?: string): string {
  if (!name?.trim()) return "";
  return name.trim().split(/\s+/)[0] || "";
}

export function applyQuickReplyVariables(
  body: string,
  vars: { name?: string; phone?: string }
): string {
  const fullName = vars.name || "";
  const firstName = firstNameFromFullName(fullName);
  return body
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{nome\}/gi, fullName)
    .replace(/\{telefone\}/gi, vars.phone || "");
}

export function previewMessageText(body: string, type?: string): string {
  if (type === "audio" || body === "[áudio]") return "Áudio";
  if (type === "image" || body === "[imagem]") return "Foto";
  if (type === "document" || body === "[documento]") return "Documento";
  if (type === "video" || body === "[vídeo]") return "Vídeo";
  if (type === "sticker" || body === "[figurinha]") return "Figurinha";
  if (type === "template") {
    const legacy = body.match(/^Template:\s*(.+?)(?:\s*—|$)/);
    if (legacy?.[1]) return legacy[1].trim();
    return body.split("\n")[0] || "Template";
  }
  return body;
}

export function previewMessageIcon(body: string, type?: string): string | null {
  if (type === "audio" || body === "[áudio]") return "🎤";
  if (type === "image" || body === "[imagem]") return "📷";
  if (type === "document" || body === "[documento]") return "📎";
  if (type === "video" || body === "[vídeo]") return "🎬";
  if (type === "sticker" || body === "[figurinha]") return "🎭";
  if (type === "template") return "📋";
  return null;
}

export function contactInitials(name?: string, phone?: string): string {
  const source = (name || phone || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function contactAvatarColors(seed: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: `hsla(${hue}, 55%, 42%, 0.28)`,
    color: `hsl(${hue}, 75%, 78%)`,
  };
}
