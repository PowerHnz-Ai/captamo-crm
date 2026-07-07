import type { MessageStatus, MessageType } from "../types";

export type ProviderType = "meta_cloud" | "wasender" | "evolution";

export interface WhatsAppConfig {
  provider: ProviderType;
  companyId: string;
  phoneNumberId?: string;
  wabaId?: string;
  instanceId?: string;
  apiKey?: string;
  token?: string;
  webhookVerifyToken?: string;
  messagingLimitTier?: number;
  dailyCap?: number;
  baseUrl?: string;
}

export interface SendTextParams {
  to: string;
  body: string;
  /** Responde citando esta mensagem (context/quoted no WhatsApp). */
  replyToWhatsappMessageId?: string;
}

export interface SendReactionParams {
  to: string;
  targetWhatsappMessageId: string;
  /** Emoji da reação; string vazia remove a reação. */
  emoji: string;
}

export interface SendTemplateParams {
  to: string;
  templateName: string;
  language: string;
  parameters: string[];
  headerImage?: { storagePath?: string; link?: string };
}

export interface SendMediaParams {
  to: string;
  type: "image" | "audio" | "document";
  mediaUrl?: string;
  storagePath?: string;
  mimeType: string;
  caption?: string;
  filename?: string;
  preparedBuffer?: Buffer;
  skipAudioPrep?: boolean;
  /** Responde citando esta mensagem (context/quoted no WhatsApp). */
  replyToWhatsappMessageId?: string;
}

export interface SendResult {
  messageId?: string;
  raw: unknown;
}

export interface TemplateDraft {
  name: string;
  language: string;
  category: string;
  body: string;
  header?: {
    type: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    text?: string;
    mediaUrl?: string;
    storagePath?: string;
    mediaAssetId?: string;
  };
  variableSamples?: string[];
  footer?: string;
  buttons?: Array<
    | { type: "QUICK_REPLY"; text: string }
    | { type: "URL"; text: string; url: string }
    | { type: "PHONE_NUMBER"; text: string; phone: string }
    | { type: "COPY_CODE"; text: string }
  >;
}

export interface ProviderTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: "approved" | "pending" | "rejected" | "draft";
  body: string;
}

export interface MessageMedia {
  url?: string;
  mimeType?: string;
  caption?: string;
  storagePath?: string;
}

export interface NormalizedInboundMessage {
  type: "inbound_message";
  phone: string;
  messageId: string;
  messageType: MessageType;
  body: string;
  contactName?: string;
  media?: MessageMedia;
  kind?: "message" | "reaction";
  reaction?: { emoji: string; targetWhatsappMessageId: string };
  replyToWhatsappMessageId?: string;
  interactivePayload?: string;
  raw: unknown;
}

export interface NormalizedOutboundSync {
  type: "outbound_sync";
  phone: string;
  messageId: string;
  messageType: MessageType;
  body: string;
  media?: MessageMedia;
  raw: unknown;
}

export interface NormalizedStatusUpdate {
  type: "status_update";
  messageId: string;
  status: MessageStatus;
  statusError?: string;
  raw: unknown;
}

export type NormalizedWebhookEvent =
  | NormalizedInboundMessage
  | NormalizedOutboundSync
  | NormalizedStatusUpdate;

export interface MessagingLimitInfo {
  tier: number;
  dailyLimit: number;
}

export type ConnectionState = "open" | "connecting" | "close";

export interface QrCodeResult {
  /** Imagem base64 pronta para <img> (data URI ou base64 puro). */
  base64?: string;
  /** String crua do QR (ex.: "2@...") para gerar imagem no cliente. */
  code?: string;
  /** Código de pareamento por telefone, quando disponível. */
  pairingCode?: string;
  state: ConnectionState;
}

export interface DeleteMessageParams {
  whatsappMessageId: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
}

export interface WhatsAppProvider {
  readonly type: ProviderType;
  sendText(params: SendTextParams): Promise<SendResult>;
  sendTemplate(params: SendTemplateParams): Promise<SendResult>;
  sendMedia(params: SendMediaParams): Promise<SendResult>;
  /** Envia reação a uma mensagem (emoji vazio remove). */
  sendReaction?(params: SendReactionParams): Promise<SendResult>;
  createTemplate?(
    draft: TemplateDraft
  ): Promise<{ id: string; status: string }>;
  syncTemplates?(): Promise<ProviderTemplate[]>;
  parseWebhook(
    payload: unknown,
    headers?: Headers
  ): NormalizedWebhookEvent[];
  getMessagingLimit?(): Promise<MessagingLimitInfo>;
  testConnection?(): Promise<{ ok: boolean; message: string }>;
  /** Cria a instância/sessão no provedor não oficial. */
  createInstance?(instanceId: string): Promise<{ instanceId: string }>;
  /** Garante webhook apontando para o CRM (Evolution). */
  ensureWebhook?(instanceId: string): Promise<{ ok: true; url: string }>;
  /** Inicia/obtém o QR code para conectar via celular. */
  getQrCode?(instanceId: string): Promise<QrCodeResult>;
  /** Estado atual da conexão (open/connecting/close). */
  getConnectionState?(instanceId: string): Promise<ConnectionState>;
  /** Desconecta/loga out da instância. */
  logout?(instanceId: string): Promise<void>;
  /** Apaga mensagem para todos (somente não oficiais). */
  deleteMessageForEveryone?(params: DeleteMessageParams): Promise<void>;
  /** Baixa mídia decodificada via Evolution (getBase64FromMediaMessage). */
  downloadMediaMessage?(
    instanceId: string,
    key: {
      id: string;
      remoteJid?: string;
      fromMe?: boolean;
      participant?: string;
    }
  ): Promise<{ buffer: Buffer; mimeType: string }>;
}

export class WhatsAppProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "WhatsAppProviderError";
  }
}

/** Empresa sem credenciais da API — envio bloqueado até a equipe ativar. */
export class WhatsAppNotConfiguredError extends WhatsAppProviderError {
  constructor(
    message = "WhatsApp não configurado para esta conta. Solicite a ativação à equipe Captamo."
  ) {
    super(message, 422);
    this.name = "WhatsAppNotConfiguredError";
  }
}
