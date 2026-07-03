import type { MessageStatus, MessageType } from "../types";
import { extractMessageId, normalizePhone } from "./phone";
import type {
  ConnectionState,
  DeleteMessageParams,
  MessageMedia,
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

interface EvolutionMessageKey {
  id?: string;
  remoteJid?: string;
  fromMe?: boolean;
  participant?: string;
  senderPn?: string;
  previousRemoteJid?: string;
  remoteJidAlt?: string;
}

interface EvolutionMessageContent {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; mimetype?: string; url?: string; base64?: string };
  audioMessage?: { mimetype?: string; url?: string; base64?: string };
  pttMessage?: { mimetype?: string; url?: string; base64?: string };
  videoMessage?: { caption?: string; mimetype?: string; url?: string };
  documentMessage?: {
    caption?: string;
    mimetype?: string;
    url?: string;
    fileName?: string;
  };
  stickerMessage?: { mimetype?: string; url?: string };
  ephemeralMessage?: { message?: EvolutionMessageContent };
  viewOnceMessage?: { message?: EvolutionMessageContent };
  buttonsResponseMessage?: {
    selectedDisplayText?: string;
    selectedButtonId?: string;
  };
  listResponseMessage?: {
    title?: string;
    singleSelectReply?: { selectedRowId?: string };
  };
}

interface EvolutionWebhookItem {
  key?: EvolutionMessageKey;
  pushName?: string;
  message?: EvolutionMessageContent;
  messageTimestamp?: number;
  status?: string;
  update?: { status?: string };
}

interface EvolutionWebhookRoot {
  event?: string;
  instance?: string;
  sender?: string;
  data?: EvolutionWebhookItem | EvolutionWebhookItem[];
}

function unwrapEvolutionMessage(
  message?: EvolutionMessageContent
): EvolutionMessageContent | undefined {
  if (!message) return undefined;
  if (message.ephemeralMessage?.message) {
    return unwrapEvolutionMessage(message.ephemeralMessage.message);
  }
  if (message.viewOnceMessage?.message) {
    return unwrapEvolutionMessage(message.viewOnceMessage.message);
  }
  return message;
}

function isInboundMessageEvent(event?: string): boolean {
  return normalizeEventName(event) === "messages.upsert";
}

function isGroupOrBroadcastJid(jid?: string): boolean {
  if (!jid) return false;
  return (
    jid.includes("@g.us") ||
    jid.includes("@broadcast") ||
    jid.includes("@newsletter")
  );
}

function shouldSkipEvolutionInbound(item: EvolutionWebhookItem): boolean {
  const remoteJid = item.key?.remoteJid;
  if (!remoteJid) return false;
  return isGroupOrBroadcastJid(remoteJid);
}

function jidToPhoneDigits(jid: string): string {
  return jid.replace(/@.*/, "").replace(/\D/g, "");
}

function phoneFromJid(raw?: string): string {
  if (!raw || isGroupOrBroadcastJid(raw)) return "";
  if (raw.endsWith("@lid")) return "";

  const digits = jidToPhoneDigits(raw);
  if (digits.length < 10) return "";

  try {
    return normalizePhone(digits);
  } catch {
    return digits;
  }
}

function extractEvolutionChatPhone(item: EvolutionWebhookItem): string {
  const remoteJid = item.key?.remoteJidAlt || item.key?.remoteJid;
  if (!remoteJid || isGroupOrBroadcastJid(remoteJid)) return "";
  if (remoteJid.endsWith("@lid")) return "";
  return phoneFromJid(remoteJid);
}

function extractEvolutionPhone(item: EvolutionWebhookItem): string {
  const key = item.key;
  if (!key) return "";

  const fromSenderPn = phoneFromJid(key.senderPn);
  if (fromSenderPn) return fromSenderPn;

  const remoteJid = key.remoteJidAlt || key.remoteJid;
  if (remoteJid?.endsWith("@lid")) {
    return "";
  }

  const fromRemote = phoneFromJid(remoteJid);
  if (fromRemote) return fromRemote;

  return "";
}

function extractEvolutionWebhookItems(
  data: EvolutionWebhookRoot["data"]
): EvolutionWebhookItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  const nested = data as { messages?: EvolutionWebhookItem[] };
  if (Array.isArray(nested.messages)) return nested.messages;

  return [data];
}

export interface EvolutionMediaMessageKey {
  id: string;
  remoteJid?: string;
  fromMe?: boolean;
  participant?: string;
}

export function extractEvolutionMessageKeyFromWebhook(
  raw: unknown,
  messageId: string
): EvolutionMediaMessageKey | null {
  const root = raw as EvolutionWebhookRoot;
  const items = extractEvolutionWebhookItems(root.data);

  for (const item of items) {
    if (item.key?.id === messageId) {
      return {
        id: item.key.id,
        remoteJid: item.key.remoteJid,
        fromMe: item.key.fromMe,
        participant: item.key.participant,
      };
    }
  }

  const single = root.data as EvolutionWebhookItem | undefined;
  if (single?.key?.id === messageId) {
    return {
      id: single.key.id,
      remoteJid: single.key.remoteJid,
      fromMe: single.key.fromMe,
      participant: single.key.participant,
    };
  }

  return null;
}

function parseEvolutionAudioFields(audio: {
  mimetype?: string;
  url?: string;
  base64?: string;
}): { body: string; messageType: MessageType; media: MessageMedia } {
  let url = audio.url;
  if (audio.base64) {
    url = audio.base64.startsWith("data:")
      ? audio.base64
      : `data:${audio.mimetype || "audio/ogg"};base64,${audio.base64}`;
  }
  return {
    body: "[áudio]",
    messageType: "audio",
    media: {
      url,
      mimeType: audio.mimetype || "audio/ogg",
    },
  };
}

function parseEvolutionInboundMessage(item: EvolutionWebhookItem): {
  body: string;
  messageType: MessageType;
  media?: MessageMedia;
} {
  const msg = unwrapEvolutionMessage(item.message);
  if (!msg) return { body: "", messageType: "text" };

  if (msg.conversation) {
    return { body: msg.conversation, messageType: "text" };
  }
  if (msg.extendedTextMessage?.text) {
    return { body: msg.extendedTextMessage.text, messageType: "text" };
  }
  if (msg.imageMessage) {
    return {
      body: msg.imageMessage.caption || "[imagem]",
      messageType: "image",
      media: {
        url: msg.imageMessage.url,
        mimeType: msg.imageMessage.mimetype,
        caption: msg.imageMessage.caption,
      },
    };
  }
  if (msg.audioMessage) {
    return parseEvolutionAudioFields(msg.audioMessage);
  }
  if (msg.pttMessage) {
    return parseEvolutionAudioFields(msg.pttMessage);
  }
  if (msg.videoMessage) {
    return {
      body: msg.videoMessage.caption || "[vídeo]",
      messageType: "video",
      media: {
        url: msg.videoMessage.url,
        mimeType: msg.videoMessage.mimetype,
        caption: msg.videoMessage.caption,
      },
    };
  }
  if (msg.documentMessage) {
    return {
      body:
        msg.documentMessage.caption ||
        msg.documentMessage.fileName ||
        "[documento]",
      messageType: "document",
      media: {
        url: msg.documentMessage.url,
        mimeType: msg.documentMessage.mimetype,
        caption: msg.documentMessage.caption,
      },
    };
  }
  if (msg.stickerMessage) {
    return {
      body: "[figurinha]",
      messageType: "sticker",
      media: {
        url: msg.stickerMessage.url,
        mimeType: msg.stickerMessage.mimetype,
      },
    };
  }
  if (msg.buttonsResponseMessage) {
    return {
      body:
        msg.buttonsResponseMessage.selectedDisplayText ||
        msg.buttonsResponseMessage.selectedButtonId ||
        "[resposta]",
      messageType: "text",
    };
  }
  if (msg.listResponseMessage) {
    return {
      body:
        msg.listResponseMessage.title ||
        msg.listResponseMessage.singleSelectReply?.selectedRowId ||
        "[resposta]",
      messageType: "text",
    };
  }

  return { body: "", messageType: "text" };
}

function normalizeEventName(event?: string): string {
  return (event || "").toLowerCase().replace(/_/g, ".");
}

function isMessagesUpdateEvent(event?: string): boolean {
  return normalizeEventName(event) === "messages.update";
}

function mapStatus(status: string): MessageStatus {
  const map: Record<string, MessageStatus> = {
    SERVER_ACK: "sent",
    DELIVERY_ACK: "delivered",
    READ: "read",
    ERROR: "failed",
  };
  return map[status] || "accepted";
}

function mapConnectionState(state?: string): ConnectionState {
  if (state === "open") return "open";
  if (state === "connecting") return "connecting";
  return "close";
}

export interface EvolutionWebhookConfig {
  url: string;
  enabled: boolean;
  webhookByEvents: boolean;
  events: string[];
}

export interface EvolutionWebhookFindResult {
  enabled: boolean;
  url?: string;
  events?: string[];
}

function normalizeWebhookFind(raw: unknown): EvolutionWebhookFindResult {
  if (!raw || typeof raw !== "object") {
    return { enabled: false };
  }
  const data = raw as {
    enabled?: boolean;
    url?: string;
    events?: string[];
    webhook?: {
      enabled?: boolean;
      url?: string;
      events?: string[];
    };
  };
  const nested = data.webhook;
  return {
    enabled: nested?.enabled ?? data.enabled ?? false,
    url: nested?.url ?? data.url,
    events: nested?.events ?? data.events,
  };
}

export function isEvolutionInstanceAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof WhatsAppProviderError)) return false;
  if (error.statusCode === 403 || error.statusCode === 409) return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("already") ||
    msg.includes("exists") ||
    msg.includes("exist") ||
    msg.includes("já existe") ||
    msg.includes("ja existe")
  );
}

export function getEvolutionWebhookConfig(): EvolutionWebhookConfig {
  const appUrl =
    process.env.APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
      : undefined);
  if (!appUrl) {
    throw new WhatsAppProviderError(
      "APP_URL não configurado. Necessário para webhook da Evolution."
    );
  }
  return {
    url: `${appUrl}/api/webhook/whatsapp/evolution`,
    enabled: true,
    webhookByEvents: false,
    events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
  };
}

export class EvolutionProvider implements WhatsAppProvider {
  readonly type = "evolution" as const;

  constructor(private readonly config: WhatsAppConfig) {}

  private get baseUrl() {
    return (
      this.config.baseUrl?.replace(/\/$/, "") ||
      process.env.EVOLUTION_API_BASE_URL?.replace(/\/$/, "") ||
      "http://localhost:8080"
    );
  }

  private ensureConfig() {
    const apiKey = this.config.apiKey || this.config.token;
    const instance = this.config.instanceId;
    if (!apiKey) {
      throw new WhatsAppProviderError("EVOLUTION_API_KEY não configurado.");
    }
    if (!instance) {
      throw new WhatsAppProviderError("EVOLUTION_INSTANCE_ID não configurado.");
    }
    return { apiKey, instance };
  }

  private async request(
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const { apiKey } = this.ensureConfig();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data as { message?: string; error?: string };
      throw new WhatsAppProviderError(
        err.message || err.error || "Erro Evolution API.",
        response.status,
        data
      );
    }
    return data;
  }

  async sendText(params: SendTextParams): Promise<SendResult> {
    const { instance } = this.ensureConfig();
    const to = normalizePhone(params.to);
    const raw = await this.request(`/message/sendText/${instance}`, {
      number: to,
      text: params.body,
    });
    return { messageId: extractMessageId(raw), raw };
  }

  async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
    const { instance } = this.ensureConfig();
    const to = normalizePhone(params.to);
    const raw = await this.request(`/message/sendText/${instance}`, {
      number: to,
      text: `[${params.templateName}] ${params.parameters.join(" | ")}`,
    });
    return { messageId: extractMessageId(raw), raw };
  }

  async sendMedia(params: SendMediaParams): Promise<SendResult> {
    const { instance } = this.ensureConfig();
    const to = normalizePhone(params.to);
    let media = params.mediaUrl;

    if (!media && params.storagePath) {
      const { getMediaSignedUrl } = await import("../media-storage");
      media = await getMediaSignedUrl(params.storagePath);
    }

    if (!media) {
      throw new WhatsAppProviderError("URL da mídia não informada.");
    }

    const raw = await this.request(`/message/sendMedia/${instance}`, {
      number: to,
      mediatype: params.type,
      mimetype: params.mimeType,
      media,
      fileName: params.filename || `file.${params.type}`,
      caption: params.caption,
    });
    return { messageId: extractMessageId(raw), raw };
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const root = payload as EvolutionWebhookRoot;
    const events: NormalizedWebhookEvent[] = [];
    const items = extractEvolutionWebhookItems(root.data);

    const eventName = root.event;

    for (const item of items) {
      const status = item.status || item.update?.status;
      if (isMessagesUpdateEvent(eventName) && item.key?.id && status) {
        events.push({
          type: "status_update",
          messageId: item.key.id,
          status: mapStatus(status),
          raw: root,
        });
        continue;
      }

      if (!isInboundMessageEvent(eventName)) continue;

      if (item.key?.fromMe === true) {
        if (shouldSkipEvolutionInbound(item)) continue;

        const syncPhone = extractEvolutionChatPhone(item);
        if (!syncPhone) continue;

        const synced = parseEvolutionInboundMessage(item);
        if (!synced.body && synced.messageType === "text") continue;

        events.push({
          type: "outbound_sync",
          phone: syncPhone,
          messageId: item.key?.id || `evo-out-${Date.now()}`,
          messageType: synced.messageType,
          body: synced.body || `[${synced.messageType}]`,
          media: synced.media,
          raw: root,
        });
        continue;
      }

      if (shouldSkipEvolutionInbound(item)) continue;

      const phone = extractEvolutionPhone(item);
      if (!phone) continue;

      const { body, messageType, media } = parseEvolutionInboundMessage(item);
      if (!body && messageType === "text") continue;

      events.push({
        type: "inbound_message",
        phone,
        messageId: item.key?.id || `evo-${Date.now()}`,
        messageType,
        body: body || `[${messageType}]`,
        contactName: item.pushName,
        media,
        raw: root,
      });
    }

    return events;
  }

  private get apiKey(): string {
    const key = this.config.apiKey || this.config.token;
    if (!key) {
      throw new WhatsAppProviderError("EVOLUTION_API_KEY não configurado.");
    }
    return key;
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data as { message?: string; error?: string };
      throw new WhatsAppProviderError(
        err.message || err.error || "Erro Evolution API.",
        response.status,
        data
      );
    }
    return data;
  }

  async createInstance(instanceId: string): Promise<{ instanceId: string }> {
    const webhook = getEvolutionWebhookConfig();
    const body: Record<string, unknown> = {
      instanceName: instanceId,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        url: webhook.url,
        enabled: webhook.enabled,
        webhookByEvents: webhook.webhookByEvents,
        webhookBase64: false,
        events: webhook.events,
      },
    };
    await this.rawRequest("POST", "/instance/create", body);
    await this.ensureWebhook(instanceId);
    return { instanceId };
  }

  async findWebhook(instanceId: string): Promise<EvolutionWebhookFindResult> {
    const raw = await this.rawRequest("GET", `/webhook/find/${instanceId}`);
    return normalizeWebhookFind(raw);
  }

  private isWebhookConfigured(
    found: EvolutionWebhookFindResult,
    expectedUrl: string
  ): boolean {
    if (!found.enabled || !found.url?.trim()) return false;
    return found.url.replace(/\/$/, "") === expectedUrl.replace(/\/$/, "");
  }

  async ensureWebhook(instanceId: string): Promise<{ ok: true; url: string }> {
    const webhook = getEvolutionWebhookConfig();
    const nestedPayloads: Record<string, unknown>[] = [
      {
        webhook: {
          enabled: webhook.enabled,
          url: webhook.url,
          webhookByEvents: webhook.webhookByEvents,
          webhookBase64: false,
          events: webhook.events,
        },
      },
      {
        webhook: {
          enabled: webhook.enabled,
          url: webhook.url,
          byEvents: webhook.webhookByEvents,
          base64: false,
          events: webhook.events,
        },
      },
    ];

    let lastError: unknown;
    for (const payload of nestedPayloads) {
      try {
        const setResult = await this.rawRequest(
          "POST",
          `/webhook/set/${instanceId}`,
          payload
        );
        const fromSet = normalizeWebhookFind(setResult);
        if (this.isWebhookConfigured(fromSet, webhook.url)) {
          return { ok: true, url: webhook.url };
        }

        const found = await this.findWebhook(instanceId);
        if (this.isWebhookConfigured(found, webhook.url)) {
          return { ok: true, url: webhook.url };
        }
      } catch (error) {
        lastError = error;
        console.error(
          `[EvolutionProvider] Falha ao configurar webhook (${instanceId}):`,
          error
        );
      }
    }

    const detail =
      lastError instanceof WhatsAppProviderError
        ? lastError.message
        : lastError instanceof Error
          ? lastError.message
          : "erro desconhecido";
    throw new WhatsAppProviderError(
      `Webhook não configurado na Evolution para instância ${instanceId}. URL esperada: ${webhook.url}. Detalhe: ${detail}`,
      lastError instanceof WhatsAppProviderError ? lastError.statusCode : undefined,
      lastError instanceof WhatsAppProviderError ? lastError.details : lastError
    );
  }

  async getQrCode(instanceId: string): Promise<QrCodeResult> {
    const raw = (await this.rawRequest(
      "GET",
      `/instance/connect/${instanceId}`
    )) as {
      base64?: string;
      code?: string;
      pairingCode?: string;
      instance?: { state?: string };
      state?: string;
    };
    const state = mapConnectionState(raw.instance?.state || raw.state);
    return {
      base64: raw.base64,
      code: raw.code,
      pairingCode: raw.pairingCode,
      state: raw.base64 || raw.code ? "connecting" : state,
    };
  }

  async getConnectionState(instanceId: string): Promise<ConnectionState> {
    const raw = (await this.rawRequest(
      "GET",
      `/instance/connectionState/${instanceId}`
    )) as { instance?: { state?: string }; state?: string };
    return mapConnectionState(raw.instance?.state || raw.state);
  }

  async logout(instanceId: string): Promise<void> {
    await this.rawRequest("DELETE", `/instance/logout/${instanceId}`).catch(
      () => undefined
    );
  }

  async deleteMessageForEveryone(params: DeleteMessageParams): Promise<void> {
    const { instance } = this.ensureConfig();
    await this.rawRequest(
      "DELETE",
      `/chat/deleteMessageForEveryone/${instance}`,
      {
        id: params.whatsappMessageId,
        remoteJid: params.remoteJid,
        fromMe: params.fromMe,
        ...(params.participant ? { participant: params.participant } : {}),
      }
    );
  }

  async downloadMediaMessage(
    instanceId: string,
    key: EvolutionMediaMessageKey
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const raw = await this.rawRequest(
      "POST",
      `/chat/getBase64FromMediaMessage/${instanceId}`,
      {
        message: {
          key: {
            id: key.id,
            ...(key.remoteJid ? { remoteJid: key.remoteJid } : {}),
            ...(key.fromMe !== undefined ? { fromMe: key.fromMe } : {}),
            ...(key.participant ? { participant: key.participant } : {}),
          },
        },
        convertToMp4: false,
      }
    );

    const data = raw as {
      base64?: string;
      mimetype?: string;
      mimeType?: string;
      mediaType?: string;
      media?: { base64?: string; mimetype?: string; mimeType?: string };
    };

    const base64 =
      data.base64 ||
      data.media?.base64 ||
      (typeof raw === "string" ? raw : undefined);

    if (!base64) {
      throw new WhatsAppProviderError(
        "Evolution não retornou base64 da mídia.",
        undefined,
        raw
      );
    }

    const payload = base64.includes(",") ? base64.split(",")[1]! : base64;
    const buffer = Buffer.from(payload, "base64");
    const mimeType =
      data.mimetype ||
      data.mimeType ||
      data.mediaType ||
      data.media?.mimetype ||
      data.media?.mimeType ||
      "audio/ogg";

    return { buffer, mimeType };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const { apiKey, instance } = this.ensureConfig();
      const response = await fetch(
        `${this.baseUrl}/instance/connectionState/${instance}`,
        { headers: { apikey: apiKey } }
      );
      if (!response.ok) {
        return { ok: false, message: "Evolution API inacessível." };
      }
      const data = (await response.json()) as { state?: string };
      return {
        ok: data.state === "open",
        message: `Instância ${instance}: ${data.state || "desconhecido"}`,
      };
    } catch (error) {
      const msg =
        error instanceof WhatsAppProviderError
          ? error.message
          : "Falha ao conectar Evolution API.";
      return { ok: false, message: msg };
    }
  }
}
