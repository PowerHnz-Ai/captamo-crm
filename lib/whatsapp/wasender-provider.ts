import type { MessageStatus, MessageType } from "../types";
import { extractMessageId, normalizePhone } from "./phone";
import type {
  ConnectionState,
  DeleteMessageParams,
  NormalizedWebhookEvent,
  QrCodeResult,
  SendMediaParams,
  SendResult,
  SendTemplateParams,
  SendTextParams,
  WhatsAppConfig,
  WhatsAppProvider,
} from "./types";
import { WhatsAppProviderError } from "./types";

function mapWasenderState(status?: string): ConnectionState {
  if (status === "connected") return "open";
  if (status === "connecting" || status === "need_scan") return "connecting";
  return "close";
}

function mapMessageType(type: string): MessageType {
  if (type === "text" || type === "chat") return "text";
  if (type === "image") return "image";
  if (type === "audio" || type === "ptt") return "audio";
  if (type === "document") return "document";
  if (type === "video") return "video";
  if (type === "sticker") return "sticker";
  return "unknown";
}

function mapStatus(status: string): MessageStatus {
  const map: Record<string, MessageStatus> = {
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
    error: "failed",
  };
  return map[status.toLowerCase()] || "accepted";
}

export class WasenderProvider implements WhatsAppProvider {
  readonly type = "wasender" as const;

  constructor(private readonly config: WhatsAppConfig) {}

  private get baseUrl() {
    return (
      this.config.baseUrl?.replace(/\/$/, "") ||
      "https://www.wasenderapi.com/api"
    );
  }

  private ensureConfig() {
    const apiKey = this.config.apiKey || this.config.token;
    if (!apiKey) {
      throw new WhatsAppProviderError("WASENDER_API_KEY não configurado.");
    }
    return { apiKey };
  }

  private async request(
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const { apiKey } = this.ensureConfig();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data as { message?: string; error?: string };
      throw new WhatsAppProviderError(
        err.message || err.error || "Erro Wasender API.",
        response.status,
        data
      );
    }
    return data;
  }

  async sendText(params: SendTextParams): Promise<SendResult> {
    const to = normalizePhone(params.to);
    const raw = await this.request("/send-message", {
      phone: to,
      message: params.body,
      session: this.config.instanceId,
    });
    return { messageId: extractMessageId(raw), raw };
  }

  async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
    const to = normalizePhone(params.to);
    const body = params.parameters.join(" | ");
    const raw = await this.request("/send-message", {
      phone: to,
      message: `[${params.templateName}] ${body}`,
      session: this.config.instanceId,
    });
    return { messageId: extractMessageId(raw), raw };
  }

  async sendMedia(params: SendMediaParams): Promise<SendResult> {
    const to = normalizePhone(params.to);
    let mediaUrl = params.mediaUrl;

    if (!mediaUrl && params.storagePath) {
      const { getMediaSignedUrl } = await import("../media-storage");
      mediaUrl = await getMediaSignedUrl(params.storagePath);
    }

    if (!mediaUrl) {
      throw new WhatsAppProviderError("URL da mídia não informada.");
    }

    const typeMap = {
      image: "image",
      audio: "audio",
      document: "document",
    } as const;

    const raw = await this.request("/send-message", {
      phone: to,
      message: params.caption || "",
      mediaUrl,
      type: typeMap[params.type],
      mimetype: params.mimeType,
      session: this.config.instanceId,
      fileName: params.filename,
    });
    return { messageId: extractMessageId(raw), raw };
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const data = payload as {
      event?: string;
      data?: {
        id?: string;
        messageId?: string;
        from?: string;
        phone?: string;
        body?: string;
        text?: string;
        type?: string;
        status?: string;
        pushName?: string;
        session?: string;
        mediaUrl?: string;
        mimetype?: string;
      };
    };

    const item = data.data;
    if (!item) return [];

    const events: NormalizedWebhookEvent[] = [];

    if (
      data.event === "message" ||
      data.event === "messages.upsert" ||
      item.body ||
      item.text
    ) {
      const phone = (item.from || item.phone || "").replace(/\D/g, "");
      if (!phone) return events;

      events.push({
        type: "inbound_message",
        phone,
        messageId: item.id || item.messageId || `wasender-${Date.now()}`,
        messageType: mapMessageType(item.type || "text"),
        body: item.body || item.text || "",
        contactName: item.pushName,
        media: item.mediaUrl
          ? { url: item.mediaUrl, mimeType: item.mimetype }
          : undefined,
        raw: data,
      });
    }

    if (data.event === "message.status" || item.status) {
      const messageId = item.id || item.messageId;
      if (messageId && item.status) {
        events.push({
          type: "status_update",
          messageId,
          status: mapStatus(item.status),
          raw: data,
        });
      }
    }

    return events;
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const { apiKey } = this.ensureConfig();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data as { message?: string; error?: string };
      throw new WhatsAppProviderError(
        err.message || err.error || "Erro Wasender API.",
        response.status,
        data
      );
    }
    return data;
  }

  async createInstance(instanceId: string): Promise<{ instanceId: string }> {
    const raw = (await this.rawRequest("POST", "/whatsapp-sessions", {
      name: instanceId,
    })) as { data?: { id?: string | number } };
    const id = raw.data?.id != null ? String(raw.data.id) : instanceId;
    return { instanceId: id };
  }

  async getQrCode(instanceId: string): Promise<QrCodeResult> {
    await this.rawRequest(
      "POST",
      `/whatsapp-sessions/${instanceId}/connect`
    ).catch(() => undefined);
    const raw = (await this.rawRequest(
      "GET",
      `/whatsapp-sessions/${instanceId}/qrcode`
    )) as { data?: { qrCode?: string } };
    return {
      code: raw.data?.qrCode,
      state: "connecting",
    };
  }

  async getConnectionState(instanceId: string): Promise<ConnectionState> {
    const raw = (await this.rawRequest(
      "GET",
      `/whatsapp-sessions/${instanceId}`
    )) as { data?: { status?: string }; status?: string };
    return mapWasenderState(raw.data?.status || raw.status);
  }

  async logout(instanceId: string): Promise<void> {
    await this.rawRequest(
      "POST",
      `/whatsapp-sessions/${instanceId}/disconnect`
    ).catch(() => undefined);
  }

  async deleteMessageForEveryone(params: DeleteMessageParams): Promise<void> {
    await this.rawRequest("DELETE", `/messages/${params.whatsappMessageId}`);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      this.ensureConfig();
      return { ok: true, message: "Credenciais Wasender configuradas." };
    } catch (error) {
      const msg =
        error instanceof WhatsAppProviderError
          ? error.message
          : "Falha Wasender.";
      return { ok: false, message: msg };
    }
  }
}
