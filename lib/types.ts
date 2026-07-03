import type { Timestamp } from "firebase-admin/firestore";
import type { ProviderType } from "./whatsapp/types";

export type ConversationStatus = "open" | "closed";
export type MessageDirection = "inbound" | "outbound";
export type MessageType =
  | "text"
  | "template"
  | "status"
  | "image"
  | "audio"
  | "document"
  | "video"
  | "sticker"
  | "unknown";
export type MessageStatus =
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "received";
export type TemplateStatus =
  | "draft"
  | "approved"
  | "pending"
  | "rejected"
  | "submitted";
export type CampaignStatus = "draft" | "running" | "paused" | "finished";
export type CampaignJobStatus = "pending" | "sent" | "failed" | "skipped";
export type CampaignAudienceType =
  | "all"
  | "tags"
  | "list"
  | "manual"
  | "spreadsheet"
  | "origin"
  | "classes";
export type CampaignDispatchMode = "immediate" | "cadence";
export type CampaignDuplicatePolicy = "tag_existing" | "skip" | "update";
export type CadenceStrategy = "interval" | "per_hour" | "spread_until_end";

export interface CampaignAudienceConfig {
  tags?: string[];
  contactListId?: string;
  contactIds?: string[];
  spreadsheetTag?: string;
  columnMapping?: Record<string, string>;
  originId?: string;
  originFieldFilters?: Record<string, string>;
  leadClasses?: number[];
}

export interface CampaignCadenceConfig {
  strategy: CadenceStrategy;
  intervalMinutes?: number;
  messagesPerHour?: number;
  messagesPerTick?: number;
}

export interface CampaignQuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

export interface CampaignImportStats {
  total: number;
  imported: number;
  skipped: number;
  invalid: number;
  updated?: number;
}

export interface MessageMedia {
  url?: string;
  mimeType?: string;
  caption?: string;
  storagePath?: string;
}

export type QuickReplyScope = "company" | "personal";

export interface QuickReply {
  id: string;
  companyId: string;
  title: string;
  body: string;
  scope: QuickReplyScope;
  createdBy?: string;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ContactOriginFieldType = "month" | "text" | "phone" | "contact_ref";

export interface ContactOriginField {
  key: string;
  label: string;
  type: ContactOriginFieldType;
  required?: boolean;
}

export interface ContactOrigin {
  id: string;
  companyId: string;
  key: string;
  label: string;
  isSystem: boolean;
  fields: ContactOriginField[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  source: string;
  tags: string[];
  optIn: boolean;
  blocked: boolean;
  archived?: boolean;
  notes?: string;
  customFields?: Record<string, string>;
  originId?: string;
  originFields?: Record<string, string>;
  /** 1=qualificado, 2=interesse futuro, 3=frio ativo, 4=sem interesse, 5=bloqueado */
  leadClass?: number | null;
  companyId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string;
  tagFilter?: string[];
  contactIds?: string[];
  companyId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Conversation {
  id: string;
  contactId: string;
  phone: string;
  status: ConversationStatus;
  lastMessageAt: Timestamp;
  lastInboundAt?: Timestamp;
  lastMessagePreview?: string;
  unreadCount: number;
  assignedTo?: string;
  assignedAt?: Timestamp;
  firstResponseAt?: Timestamp;
  /** Conexão WhatsApp ativa para envio nesta conversa. */
  connectionId?: string;
  companyId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MessageReplyPreview {
  messageId?: string;
  whatsappMessageId?: string;
  body: string;
  type?: MessageType;
  senderLabel?: string;
  mediaStoragePath?: string;
}

export interface MessageReaction {
  emoji: string;
  from: "contact" | "business";
  whatsappMessageId?: string;
}

export interface Message {
  id: string;
  contactId: string;
  conversationId: string;
  whatsappMessageId?: string;
  direction: MessageDirection;
  type: MessageType;
  body: string;
  status: MessageStatus;
  media?: MessageMedia;
  templateName?: string;
  templateParameters?: string[];
  templateRenderedBody?: string;
  templateFooter?: string;
  templateButtons?: TemplateButton[];
  replyTo?: MessageReplyPreview;
  reactions?: MessageReaction[];
  interactivePayload?: string;
  rawPayload?: unknown;
  statusError?: string;
  /** Conexão WhatsApp pela qual a mensagem entrou/saiu. */
  connectionId?: string;
  /** Marca de mensagem apagada para todos. */
  deletedAt?: Timestamp;
  /** UID do atendente que enviou (mensagens outbound pelo CRM). */
  sentByUid?: string;
  /** Nome do atendente no momento do envio. */
  sentByName?: string;
  createdAt: Timestamp;
}

export type TemplateHeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export interface TemplateHeader {
  type: TemplateHeaderType;
  text?: string;
  mediaUrl?: string;
  storagePath?: string;
  mediaAssetId?: string;
}

export type MediaAssetSource = "template" | "campaign" | "manual";

export interface MediaAsset {
  id: string;
  companyId: string;
  name: string;
  storagePath: string;
  mimeType: string;
  filename: string;
  source: MediaAssetSource;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE_NUMBER"; text: string; phone: string }
  | { type: "COPY_CODE"; text: string };

export interface TemplateDraftRich {
  name: string;
  language: string;
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  header?: TemplateHeader;
  body: string;
  variableSamples: string[];
  footer?: string;
  buttons?: TemplateButton[];
}

export interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: TemplateStatus;
  body: string;
  header?: TemplateHeader;
  variableSamples?: string[];
  footer?: string;
  buttons?: TemplateButton[];
  companyId?: string;
  provider?: ProviderType;
  metaTemplateId?: string;
  requiresMetaApproval?: boolean;
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Campaign {
  id: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  status: CampaignStatus;
  contactListId?: string;
  audienceType?: CampaignAudienceType;
  audienceConfig?: CampaignAudienceConfig;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  skippedCount?: number;
  maxSendsPerRun?: number;
  parameterMapping?: string[];
  contactOriginId?: string;
  contactOriginKey?: string;
  dispatchMode?: CampaignDispatchMode;
  cadenceConfig?: CampaignCadenceConfig;
  scheduledAt?: Timestamp;
  scheduledEndAt?: Timestamp;
  dailySendLimit?: number;
  dailySentDate?: string;
  dailySentCount?: number;
  quietHours?: CampaignQuietHours;
  duplicatePolicy?: CampaignDuplicatePolicy;
  excludeRecentDays?: number;
  excludeTags?: string[];
  excludeLeadClasses?: number[];
  importStats?: CampaignImportStats;
  headerImageAssetId?: string;
  headerImageStoragePath?: string;
  headerImageMode?: "fixed" | "per_contact";
  headerImageMapping?: string;
  companyId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CampaignJob {
  id: string;
  contactId: string;
  phone: string;
  contactName?: string;
  parameters: string[];
  headerImageStoragePath?: string;
  headerImageLink?: string;
  status: CampaignJobStatus;
  scheduledAt: Timestamp;
  attempts: number;
  lastError?: string;
  whatsappMessageId?: string;
  deliveryPhone?: string;
  messageStatus?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color?: string;
  companyId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Deal {
  id: string;
  title: string;
  contactId: string;
  stageId: string;
  value?: number;
  source?: string;
  assignedTo?: string;
  companyId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FunnelEvent {
  id: string;
  dealId: string;
  fromStageId?: string;
  toStageId: string;
  companyId: string;
  createdAt: Timestamp;
}

export interface IntegrationEvent {
  id: string;
  source: string;
  payload: unknown;
  status: "success" | "failed";
  companyId?: string;
  createdAt: Timestamp;
}

export interface DashboardStats {
  totalContacts: number;
  totalConversations: number;
  messagesSent: number;
  messagesReceived: number;
  messagesFailed: number;
}

export interface ConversationListItem extends Conversation {
  contactName?: string;
  contactTags?: string[];
  assignedToName?: string;
}

export type UserRole = "admin" | "gerente" | "leader" | "member";

export type ThemePreference = "dark" | "light" | "system";
export type FontSizePreference = "small" | "medium" | "large" | "xlarge";

export interface AssignmentSettings {
  enabled: boolean;
  mode: "auto" | "manual";
  strategy: "least_load" | "round_robin";
  eligibleMemberUids: string[];
  maxOpenPerMember?: number;
  reassignIfClosed: boolean;
  windowDays: number;
  lastRoundRobinUid?: string;
  /** UIDs exibidos no rail do inbox (vazio = todos os membros). */
  inboxAttendantUids?: string[];
  /** Ordem dos atendentes no rail do inbox. */
  inboxAttendantOrder?: string[];
}

export interface UserPreferences {
  theme: ThemePreference;
  /** Cor de destaque em hex (ex.: #10b981). */
  accent: string;
  fontSize: FontSizePreference;
}

/** @deprecated Use UserRole on users.role */
export type UserCargo = UserRole | "atendimento";

export interface TeamUser {
  uid: string;
  email?: string;
  name?: string;
  /** Nome curto para assinatura no WhatsApp e rótulo no chat. */
  username?: string;
  role?: UserRole | string;
  /** @deprecated Read-only legacy field */
  cargo?: UserCargo;
  /** Cargo/título profissional (exibição). */
  jobTitle?: string;
  /** Caminho no Storage (companies/{companyId}/avatars/{uid}/...). */
  photoStoragePath?: string;
  photoUpdatedAt?: Timestamp;
  /** false = removido da empresa (soft delete). */
  active?: boolean;
}

export interface CompanyWhatsAppSettings {
  provider: ProviderType;
  phoneNumberId?: string;
  wabaId?: string;
  instanceId?: string;
  apiKeyRef?: string;
  webhookVerifyToken?: string;
  messagingLimitTier?: number;
  dailyCap?: number;
  baseUrl?: string;
}

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

/**
 * Conexão WhatsApp de uma empresa. Cada empresa pode ter várias (números
 * diferentes), oficiais (Meta) ou não oficiais (Wasender/Evolution).
 */
export interface Connection {
  id: string;
  companyId: string;
  label: string;
  provider: ProviderType;
  status: ConnectionStatus;
  /** Instance (Evolution) ou session (Wasender). */
  instanceId?: string;
  /** Telefone conectado (preenchido após ler o QR). */
  phoneNumber?: string;
  baseUrl?: string;
  /** Nome da env var que guarda a API key (ex.: EVOLUTION_API_KEY). */
  apiKeyRef?: string;
  /** Credenciais específicas Meta. */
  phoneNumberId?: string;
  wabaId?: string;
  messagingLimitTier?: number;
  dailyCap?: number;
  /** Conexão padrão usada quando a conversa não define uma. */
  isDefault?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
