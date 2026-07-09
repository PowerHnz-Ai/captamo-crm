import type { MessageStatus, MessageType } from "../types";
import { extractMessageId, normalizePhone } from "./phone";
import {
  parseMetaInboundMessage,
  type MetaInboundMessage,
} from "./meta-inbound-parse";
import type {
  MessagingLimitInfo,
  NormalizedWebhookEvent,
  ProviderTemplate,
  SendMediaParams,
  SendResult,
  SendTemplateParams,
  SendTextParams,
  SendReactionParams,
  TemplateDraft,
  WhatsAppConfig,
  WhatsAppProvider,
} from "./types";
import { WhatsAppNotConfiguredError, WhatsAppProviderError } from "./types";

const META_TIER_LIMITS: Record<number, number> = {
  0: 250,
  1: 1000,
  2: 10000,
  3: 100000,
  4: 1000000,
};

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

function mapDeliveryStatus(status: string): MessageStatus {
  const map: Record<string, MessageStatus> = {
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
  };
  return map[status] || "accepted";
}

export class MetaCloudProvider implements WhatsAppProvider {
  readonly type = "meta_cloud" as const;

  constructor(private readonly config: WhatsAppConfig) {}

  private resolvedAppId: string | null = null;

  private get version() {
    return process.env.META_GRAPH_API_VERSION || "v25.0";
  }

  private ensureConfig() {
    if (!this.config.token || !this.config.phoneNumberId) {
      throw new WhatsAppNotConfiguredError();
    }
    return {
      token: this.config.token,
      phoneNumberId: this.config.phoneNumberId,
      wabaId: this.config.wabaId,
    };
  }

  private async resolveMetaAppId(): Promise<string> {
    if (process.env.META_APP_ID?.trim()) {
      return process.env.META_APP_ID.trim();
    }
    if (this.resolvedAppId) {
      return this.resolvedAppId;
    }

    const { token } = this.ensureConfig();
    const url = `https://graph.facebook.com/${this.version}/debug_token?input_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = body as { error?: { message?: string } };
      throw new WhatsAppProviderError(
        err?.error?.message ||
          "Não foi possível obter o META_APP_ID. Adicione META_APP_ID no .env.local (developers.facebook.com → seu app → Configurações → Básico)."
      );
    }

    const appId = (body as { data?: { app_id?: string } }).data?.app_id;
    if (!appId) {
      throw new WhatsAppProviderError(
        "META_APP_ID não configurado. Adicione META_APP_ID no .env.local (developers.facebook.com → seu app → Configurações → Básico)."
      );
    }

    this.resolvedAppId = appId;
    return appId;
  }

  private async graphRequest(
    path: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const { token } = this.ensureConfig();
    const url = `https://graph.facebook.com/${this.version}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = body as { error?: { message?: string; code?: number } };
      throw new WhatsAppProviderError(
        err?.error?.message || "Erro ao chamar API Meta.",
        response.status,
        body
      );
    }
    return body;
  }

  async sendText(params: SendTextParams): Promise<SendResult> {
    const { phoneNumberId } = this.ensureConfig();
    const to = normalizePhone(params.to);
    const raw = await this.graphRequest(`/${phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: params.body },
        ...(params.replyToWhatsappMessageId
          ? { context: { message_id: params.replyToWhatsappMessageId } }
          : {}),
      }),
    });
    return { messageId: extractMessageId(raw), raw };
  }

  async sendReaction(params: SendReactionParams): Promise<SendResult> {
    const { phoneNumberId } = this.ensureConfig();
    const to = normalizePhone(params.to);
    const raw = await this.graphRequest(`/${phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "reaction",
        reaction: {
          message_id: params.targetWhatsappMessageId,
          emoji: params.emoji,
        },
      }),
    });
    return { messageId: extractMessageId(raw), raw };
  }

  private async resolveMediaBuffer(
    params: SendMediaParams
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const mimeType = params.mimeType;
    const filename = params.filename || `media.${params.type}`;

    if (params.storagePath) {
      const { downloadStorageMedia } = await import("../media-storage");
      const downloaded = await downloadStorageMedia(params.storagePath);
      return { buffer: downloaded.buffer, mimeType: downloaded.mimeType, filename };
    }

    if (params.mediaUrl) {
      const response = await fetch(params.mediaUrl);
      if (!response.ok) {
        throw new WhatsAppProviderError(
          `Falha ao baixar mídia para envio (${response.status}).`
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType,
        filename,
      };
    }

    throw new WhatsAppProviderError("Mídia não informada para envio.");
  }

  private resolveAudioUploadMeta(
    mimeType: string,
    filename: string
  ): { uploadType: string; blobMime: string; safeName: string } {
    const lower = mimeType.toLowerCase();
    if (lower.includes("mpeg") || lower.includes("mp3")) {
      return {
        uploadType: "audio/mpeg",
        blobMime: "audio/mpeg",
        safeName: filename.toLowerCase().endsWith(".mp3") ? filename : "audio.mp3",
      };
    }
    if (lower.includes("ogg") || lower.includes("opus")) {
      return {
        uploadType: "audio/ogg",
        blobMime: "audio/ogg",
        safeName: filename.toLowerCase().endsWith(".ogg") ? filename : "audio.ogg",
      };
    }
    const base = mimeType.split(";")[0]!.trim();
    return {
      uploadType: base,
      blobMime: base,
      safeName: filename,
    };
  }

  private async uploadMediaToMeta(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<string> {
    const { phoneNumberId, token } = this.ensureConfig();
    const lower = mimeType.toLowerCase();
    const { uploadType, blobMime, safeName } = lower.startsWith("audio/")
      ? this.resolveAudioUploadMeta(mimeType, filename)
      : {
          uploadType: mimeType.split(";")[0]!.trim(),
          blobMime: mimeType.split(";")[0]!.trim(),
          safeName: filename,
        };

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: blobMime }),
      safeName
    );
    form.append("type", uploadType);

    const url = `https://graph.facebook.com/${this.version}/${phoneNumberId}/media`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = body as { error?: { message?: string } };
      throw new WhatsAppProviderError(
        err?.error?.message || "Erro ao enviar mídia para Meta.",
        response.status,
        body
      );
    }

    const mediaId = (body as { id?: string }).id;
    if (!mediaId) {
      throw new WhatsAppProviderError("Meta não retornou ID da mídia.");
    }
    return mediaId;
  }

  async sendMedia(params: SendMediaParams): Promise<SendResult> {
    const { phoneNumberId } = this.ensureConfig();
    const to = normalizePhone(params.to);
    let buffer: Buffer;
    let mimeType = params.mimeType;
    let filename = params.filename || `media.${params.type}`;

    if (params.preparedBuffer) {
      buffer = Buffer.from(params.preparedBuffer);
    } else {
      const resolved = await this.resolveMediaBuffer(params);
      buffer = resolved.buffer;
      mimeType = resolved.mimeType;
      filename = resolved.filename;
    }

    if (params.type === "audio") {
      const { prepareOutboundAudio, WHATSAPP_AUDIO_MIME, WHATSAPP_AUDIO_FILENAME } =
        await import("../audio-transcode");
      if (params.preparedBuffer) {
        buffer = Buffer.from(params.preparedBuffer);
        mimeType = params.mimeType || WHATSAPP_AUDIO_MIME;
        filename = filename || WHATSAPP_AUDIO_FILENAME;
      } else if (params.skipAudioPrep) {
        filename = filename || WHATSAPP_AUDIO_FILENAME;
      } else {
        try {
          const prepared = await prepareOutboundAudio(buffer, mimeType);
          buffer = Buffer.from(prepared.buffer);
          mimeType = prepared.mimeType;
          filename = prepared.filename;
        } catch (error) {
          throw new WhatsAppProviderError(
            error instanceof Error
              ? error.message
              : "Não foi possível preparar o áudio para envio."
          );
        }
      }
    }

    const mediaId = await this.uploadMediaToMeta(buffer, mimeType, filename);

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to,
      type: params.type,
      ...(params.replyToWhatsappMessageId
        ? { context: { message_id: params.replyToWhatsappMessageId } }
        : {}),
    };

    if (params.type === "image") {
      payload.image = {
        id: mediaId,
        ...(params.caption ? { caption: params.caption } : {}),
      };
    } else if (params.type === "audio") {
      payload.audio = { id: mediaId };
    } else {
      payload.document = {
        id: mediaId,
        filename,
        ...(params.caption ? { caption: params.caption } : {}),
      };
    }

    const raw = await this.graphRequest(`/${phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { messageId: extractMessageId(raw), raw };
  }

  async downloadMetaMedia(
    mediaId: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const { token } = this.ensureConfig();
    const meta = (await this.graphRequest(`/${mediaId}`)) as {
      url?: string;
      mime_type?: string;
    };

    if (!meta.url) {
      throw new WhatsAppProviderError("URL da mídia Meta não disponível.");
    }

    const response = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new WhatsAppProviderError(
        `Falha ao baixar mídia Meta (${response.status}).`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: meta.mime_type || "application/octet-stream",
    };
  }

  private async uploadTemplateMediaHandle(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<string> {
    const appId = await this.resolveMetaAppId();
    const { token } = this.ensureConfig();
    const fileType = mimeType.split(";")[0]!.trim();

    const sessionUrl = `https://graph.facebook.com/${this.version}/${appId}/uploads`;
    const sessionResponse = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_length: buffer.length,
        file_type: fileType,
        file_name: filename,
      }),
    });

    const sessionBody = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok) {
      const err = sessionBody as { error?: { message?: string } };
      throw new WhatsAppProviderError(
        err?.error?.message || "Erro ao iniciar upload de mídia para template.",
        sessionResponse.status,
        sessionBody
      );
    }

    const sessionId = (sessionBody as { id?: string }).id;
    if (!sessionId) {
      throw new WhatsAppProviderError("Meta não retornou sessão de upload.");
    }

    const uploadUrl = `https://graph.facebook.com/${this.version}/${sessionId}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${token}`,
        file_offset: "0",
        "Content-Type": fileType,
      },
      body: new Uint8Array(buffer),
    });

    const uploadBody = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      const err = uploadBody as { error?: { message?: string } };
      throw new WhatsAppProviderError(
        err?.error?.message || "Erro ao enviar mídia para template.",
        uploadResponse.status,
        uploadBody
      );
    }

    const handle = (uploadBody as { h?: string }).h;
    if (!handle) {
      throw new WhatsAppProviderError("Meta não retornou handle da mídia.");
    }
    return handle;
  }

  private async resolveHeaderMediaHandle(
    header: NonNullable<TemplateDraft["header"]>
  ): Promise<string | undefined> {
    if (header.storagePath) {
      const { downloadStorageMedia } = await import("../media-storage");
      const { buffer, mimeType } = await downloadStorageMedia(header.storagePath);
      const filename = header.storagePath.split("/").pop() || "header.jpg";
      return this.uploadTemplateMediaHandle(buffer, mimeType, filename);
    }

    if (header.mediaUrl) {
      const { downloadRemoteMedia } = await import("../media-storage");
      const { buffer, mimeType } = await downloadRemoteMedia(header.mediaUrl);
      const filename = header.mediaUrl.split("/").pop()?.split("?")[0] || "header.jpg";
      return this.uploadTemplateMediaHandle(buffer, mimeType, filename);
    }

    return undefined;
  }

  private async resolveSendHeaderImage(
    headerImage: NonNullable<SendTemplateParams["headerImage"]>
  ): Promise<{ id?: string; link?: string }> {
    if (headerImage.link) {
      return { link: headerImage.link };
    }

    if (headerImage.storagePath) {
      const { downloadStorageMedia } = await import("../media-storage");
      const { buffer, mimeType } = await downloadStorageMedia(
        headerImage.storagePath
      );
      const filename =
        headerImage.storagePath.split("/").pop() || "header.jpg";
      const mediaId = await this.uploadMediaToMeta(buffer, mimeType, filename);
      return { id: mediaId };
    }

    throw new WhatsAppProviderError("Imagem de cabeçalho não informada.");
  }

  async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
    const { phoneNumberId } = this.ensureConfig();
    const to = normalizePhone(params.to);

    const components: Array<Record<string, unknown>> = [];

    if (params.headerImage) {
      const imageRef = await this.resolveSendHeaderImage(params.headerImage);
      components.push({
        type: "header",
        parameters: [
          {
            type: "image",
            image: imageRef.id ? { id: imageRef.id } : { link: imageRef.link },
          },
        ],
      });
    }

    components.push({
      type: "body",
      parameters: params.parameters.map((text) => ({
        type: "text",
        text,
      })),
    });

    const raw = await this.graphRequest(`/${phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.language },
          components,
        },
      }),
    });
    return { messageId: extractMessageId(raw), raw };
  }

  async createTemplate(
    draft: TemplateDraft
  ): Promise<{ id: string; status: string }> {
    const { wabaId } = this.ensureConfig();
    if (!wabaId) {
      throw new WhatsAppProviderError("META_WABA_ID não configurado.");
    }

    const components: Array<Record<string, unknown>> = [];

    if (draft.header && draft.header.type !== "NONE") {
      if (draft.header.type === "TEXT" && draft.header.text) {
        const headerComp: Record<string, unknown> = {
          type: "HEADER",
          format: "TEXT",
          text: draft.header.text,
        };
        const headerVars = draft.header.text.match(/\{\{\d+\}\}/g);
        if (headerVars?.length && draft.variableSamples?.length) {
          headerComp.example = { header_text: [draft.variableSamples[0]] };
        }
        components.push(headerComp);
      } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(draft.header.type)) {
        const handle = await this.resolveHeaderMediaHandle(draft.header);
        components.push({
          type: "HEADER",
          format: draft.header.type,
          ...(handle ? { example: { header_handle: [handle] } } : {}),
        });
      }
    }

    const bodyComp: Record<string, unknown> = {
      type: "BODY",
      text: draft.body,
    };
    const bodyVars = draft.body.match(/\{\{\d+\}\}/g);
    if (bodyVars?.length && draft.variableSamples?.length) {
      bodyComp.example = { body_text: [draft.variableSamples] };
    }
    components.push(bodyComp);

    if (draft.footer) {
      components.push({ type: "FOOTER", text: draft.footer });
    }

    if (draft.buttons?.length) {
      const buttons = draft.buttons.map((btn) => {
        if (btn.type === "QUICK_REPLY") {
          return { type: "QUICK_REPLY", text: btn.text };
        }
        if (btn.type === "URL") {
          return { type: "URL", text: btn.text, url: btn.url };
        }
        if (btn.type === "PHONE_NUMBER") {
          return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone };
        }
        return { type: "COPY_CODE", text: btn.text };
      });
      components.push({ type: "BUTTONS", buttons });
    }

    const raw = (await this.graphRequest(`/${wabaId}/message_templates`, {
      method: "POST",
      body: JSON.stringify({
        name: draft.name,
        language: draft.language,
        category: draft.category,
        // Sem o flag, categoria "errada" = template REPROVADO (não publica em
        // outra categoria). Com o flag, a Meta reclassifica e aprova.
        ...(draft.allowCategoryChange ? { allow_category_change: true } : {}),
        components,
      }),
    })) as { id?: string; status?: string };

    return {
      id: raw.id || draft.name,
      status: raw.status || "PENDING",
    };
  }

  async syncTemplates(): Promise<ProviderTemplate[]> {
    const { wabaId } = this.ensureConfig();
    if (!wabaId) {
      throw new WhatsAppProviderError(
        "META_WABA_ID não configurado. Adicione o ID da conta WhatsApp Business no .env.local."
      );
    }

    const all: ProviderTemplate[] = [];
    let path: string | null = `/${wabaId}/message_templates?limit=100`;

    while (path) {
      const raw = (await this.graphRequest(path)) as {
        data?: Array<{
          id: string;
          name: string;
          language: string;
          category: string;
          status: string;
          components?: Array<{ type: string; text?: string }>;
        }>;
        paging?: { next?: string };
      };

      const batch = (raw.data || []).map((t) => {
        const bodyComp = t.components?.find(
          (c) => c.type?.toUpperCase() === "BODY"
        );
        const statusMap: Record<string, ProviderTemplate["status"]> = {
          APPROVED: "approved",
          PENDING: "pending",
          REJECTED: "rejected",
          PAUSED: "approved",
        };
        const normalizedStatus = t.status?.toUpperCase() || "PENDING";
        return {
          id: t.id,
          name: t.name,
          language: t.language,
          category: t.category,
          status: statusMap[normalizedStatus] || "pending",
          body: bodyComp?.text || "",
        };
      });

      all.push(...batch);

      const next = raw.paging?.next;
      if (next) {
        path = next.replace(`https://graph.facebook.com/${this.version}`, "");
      } else {
        path = null;
      }
    }

    return all;
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const data = payload as {
      object?: string;
      entry?: Array<{
        changes?: Array<{
          value?: {
            contacts?: Array<{
              profile?: { name?: string };
              wa_id?: string;
            }>;
            messages?: MetaInboundMessage[];
            statuses?: Array<{ id: string; status: string }>;
          };
        }>;
      }>;
    };

    if (data.object !== "whatsapp_business_account") return [];

    const events: NormalizedWebhookEvent[] = [];

    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        const contactNames = new Map<string, string>();
        for (const c of value.contacts || []) {
          if (c.wa_id && c.profile?.name) {
            contactNames.set(c.wa_id, c.profile.name);
          }
        }

        for (const message of value.messages || []) {
          const parsed = parseMetaInboundMessage(message);

          events.push({
            type: "inbound_message",
            phone: message.from,
            messageId: message.id,
            messageType: parsed.messageType,
            body: parsed.body,
            contactName: contactNames.get(message.from),
            media: parsed.media,
            kind: parsed.kind,
            reaction: parsed.reaction,
            replyToWhatsappMessageId: parsed.replyToWhatsappMessageId,
            interactivePayload: parsed.interactivePayload,
            raw: message,
          });
        }

        for (const status of value.statuses || []) {
          const statusRaw = status as {
            id: string;
            status: string;
            errors?: Array<{ title?: string; message?: string; code?: number }>;
          };
          const statusError =
            statusRaw.errors?.[0]?.message ||
            statusRaw.errors?.[0]?.title ||
            undefined;
          events.push({
            type: "status_update",
            messageId: statusRaw.id,
            status: mapDeliveryStatus(statusRaw.status),
            statusError,
            raw: status,
          });
        }
      }
    }

    return events;
  }

  async getMessagingLimit(): Promise<MessagingLimitInfo> {
    const tier = this.config.messagingLimitTier ?? 1;
    try {
      const { phoneNumberId } = this.ensureConfig();
      const raw = (await this.graphRequest(
        `/${phoneNumberId}?fields=messaging_limit_tier`
      )) as { messaging_limit_tier?: string };

      const parsed = Number(raw.messaging_limit_tier?.replace(/\D/g, "") || tier);
      const effectiveTier = Number.isFinite(parsed) ? parsed : tier;
      return {
        tier: effectiveTier,
        dailyLimit: META_TIER_LIMITS[effectiveTier] ?? META_TIER_LIMITS[1]!,
      };
    } catch {
      return {
        tier,
        dailyLimit: META_TIER_LIMITS[tier] ?? 1000,
      };
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const { phoneNumberId } = this.ensureConfig();
      await this.graphRequest(
        `/${phoneNumberId}?fields=display_phone_number,verified_name`
      );
      return { ok: true, message: "Conexão Meta Cloud API OK." };
    } catch (error) {
      const msg =
        error instanceof WhatsAppProviderError
          ? error.message
          : "Falha ao testar conexão Meta.";
      return { ok: false, message: msg };
    }
  }
}
