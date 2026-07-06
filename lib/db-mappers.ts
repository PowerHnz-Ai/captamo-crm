import type {
  Contact as ContactRow,
  ContactList as ContactListRow,
  Conversation as ConversationRow,
  Message as MessageRow,
  Template as TemplateRow,
  Campaign as CampaignRow,
  CampaignJob as CampaignJobRow,
  Connection as ConnectionRow,
  QuickReply as QuickReplyRow,
  ContactOrigin as ContactOriginRow,
  MediaAsset as MediaAssetRow,
  PipelineStage as PipelineStageRow,
  Deal as DealRow,
  FunnelEvent as FunnelEventRow,
} from "@prisma/client";
import type {
  Contact,
  ContactList,
  Conversation,
  Message,
  Template,
  Campaign,
  CampaignJob,
  Connection,
  QuickReply,
  ContactOrigin,
  MediaAsset,
  PipelineStage,
  Deal,
  FunnelEvent,
} from "./types";
import { normalizePhone } from "./whatsapp/phone";

/** Normaliza telefone sem lançar — fallback remove símbolos (mesmo do legado). */
export function safeNormalizePhone(phone: string): string {
  try {
    return normalizePhone(phone);
  } catch {
    return phone.replace(/[\s+\-()]/g, "");
  }
}

function ms(date: Date): number;
function ms(date: Date | null): number | undefined;
function ms(date: Date | null): number | undefined {
  return date ? date.getTime() : undefined;
}

function orUndef<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function json<T>(value: unknown): T | undefined {
  return value === null || value === undefined ? undefined : (value as T);
}

export function contactFromRow(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    source: row.source,
    tags: json<string[]>(row.tags) || [],
    optIn: row.optIn,
    blocked: row.blocked,
    archived: row.archived,
    notes: orUndef(row.notes),
    customFields: json<Record<string, string>>(row.customFields),
    originId: orUndef(row.originId),
    originFields: json<Record<string, string>>(row.originFields),
    leadClass: row.leadClass,
    companyId: row.companyId,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function contactListFromRow(row: ContactListRow): ContactList {
  return {
    id: row.id,
    name: row.name,
    description: orUndef(row.description),
    tagFilter: json<string[]>(row.tagFilter),
    contactIds: json<string[]>(row.contactIds),
    companyId: row.companyId,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function conversationFromRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    contactId: row.contactId,
    phone: row.phone,
    status: row.status as Conversation["status"],
    lastMessageAt: ms(row.lastMessageAt),
    lastInboundAt: ms(row.lastInboundAt),
    lastMessagePreview: orUndef(row.lastMessagePreview),
    unreadCount: row.unreadCount,
    assignedTo: orUndef(row.assignedTo),
    assignedAt: ms(row.assignedAt),
    firstResponseAt: ms(row.firstResponseAt),
    connectionId: orUndef(row.connectionId),
    labels: json<string[]>(row.labels),
    companyId: row.companyId,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function messageFromRow(row: MessageRow): Message {
  return {
    id: row.id,
    contactId: row.contactId,
    conversationId: row.conversationId,
    whatsappMessageId: orUndef(row.whatsappMessageId),
    direction: row.direction as Message["direction"],
    type: row.type as Message["type"],
    body: row.body,
    status: row.status as Message["status"],
    media: json<Message["media"]>(row.media),
    templateName: orUndef(row.templateName),
    templateParameters: json<string[]>(row.templateParameters),
    templateRenderedBody: orUndef(row.templateRenderedBody),
    templateFooter: orUndef(row.templateFooter),
    templateButtons: json<Message["templateButtons"]>(row.templateButtons),
    replyTo: json<Message["replyTo"]>(row.replyTo),
    reactions: json<Message["reactions"]>(row.reactions),
    interactivePayload: orUndef(row.interactivePayload),
    rawPayload: json<unknown>(row.rawPayload),
    statusError: orUndef(row.statusError),
    connectionId: orUndef(row.connectionId),
    deletedAt: ms(row.deletedAt),
    sentByUid: orUndef(row.sentByUid),
    sentByName: orUndef(row.sentByName),
    createdAt: ms(row.createdAt),
  };
}

export function templateFromRow(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status as Template["status"],
    body: row.body,
    header: json<Template["header"]>(row.header),
    variableSamples: json<string[]>(row.variableSamples),
    footer: orUndef(row.footer),
    buttons: json<Template["buttons"]>(row.buttons),
    companyId: orUndef(row.companyId),
    provider: orUndef(row.provider) as Template["provider"],
    metaTemplateId: orUndef(row.metaTemplateId),
    requiresMetaApproval: orUndef(row.requiresMetaApproval),
    submittedAt: ms(row.submittedAt),
    approvedAt: ms(row.approvedAt),
    rejectionReason: orUndef(row.rejectionReason),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function campaignFromRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    templateName: row.templateName,
    templateLanguage: row.templateLanguage,
    status: row.status as Campaign["status"],
    contactListId: orUndef(row.contactListId),
    audienceType: orUndef(row.audienceType) as Campaign["audienceType"],
    audienceConfig: json<Campaign["audienceConfig"]>(row.audienceConfig),
    totalContacts: row.totalContacts,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    maxSendsPerRun: orUndef(row.maxSendsPerRun),
    parameterMapping: json<string[]>(row.parameterMapping),
    contactOriginId: orUndef(row.contactOriginId),
    contactOriginKey: orUndef(row.contactOriginKey),
    dispatchMode: orUndef(row.dispatchMode) as Campaign["dispatchMode"],
    cadenceConfig: json<Campaign["cadenceConfig"]>(row.cadenceConfig),
    scheduledAt: ms(row.scheduledAt),
    scheduledEndAt: ms(row.scheduledEndAt),
    dailySendLimit: orUndef(row.dailySendLimit),
    dailySentDate: orUndef(row.dailySentDate),
    dailySentCount: orUndef(row.dailySentCount),
    quietHours: json<Campaign["quietHours"]>(row.quietHours),
    duplicatePolicy: orUndef(row.duplicatePolicy) as Campaign["duplicatePolicy"],
    excludeRecentDays: orUndef(row.excludeRecentDays),
    excludeTags: json<string[]>(row.excludeTags),
    excludeLeadClasses: json<number[]>(row.excludeLeadClasses),
    importStats: json<Campaign["importStats"]>(row.importStats),
    headerImageAssetId: orUndef(row.headerImageAssetId),
    headerImageStoragePath: orUndef(row.headerImageStoragePath),
    headerImageMode: orUndef(row.headerImageMode) as Campaign["headerImageMode"],
    headerImageMapping: orUndef(row.headerImageMapping),
    companyId: row.companyId,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function campaignJobFromRow(row: CampaignJobRow): CampaignJob {
  return {
    id: row.id,
    contactId: row.contactId,
    phone: row.phone,
    contactName: orUndef(row.contactName),
    parameters: json<string[]>(row.parameters) || [],
    headerImageStoragePath: orUndef(row.headerImageStoragePath),
    headerImageLink: orUndef(row.headerImageLink),
    status: row.status as CampaignJob["status"],
    scheduledAt: ms(row.scheduledAt),
    attempts: row.attempts,
    lastError: orUndef(row.lastError),
    whatsappMessageId: orUndef(row.whatsappMessageId),
    deliveryPhone: orUndef(row.deliveryPhone),
    messageStatus: orUndef(row.messageStatus),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function connectionFromRow(row: ConnectionRow): Connection {
  return {
    id: row.id,
    companyId: row.companyId,
    label: row.label,
    provider: row.provider as Connection["provider"],
    status: row.status as Connection["status"],
    instanceId: orUndef(row.instanceId),
    phoneNumber: orUndef(row.phoneNumber),
    baseUrl: orUndef(row.baseUrl),
    apiKeyRef: orUndef(row.apiKeyRef),
    phoneNumberId: orUndef(row.phoneNumberId),
    wabaId: orUndef(row.wabaId),
    messagingLimitTier: orUndef(row.messagingLimitTier),
    dailyCap: orUndef(row.dailyCap),
    isDefault: row.isDefault,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function quickReplyFromRow(row: QuickReplyRow): QuickReply {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    body: row.body,
    scope: row.scope as QuickReply["scope"],
    createdBy: orUndef(row.createdBy),
    sortOrder: row.sortOrder,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function contactOriginFromRow(row: ContactOriginRow): ContactOrigin {
  return {
    id: row.id,
    companyId: row.companyId,
    key: row.key,
    label: row.label,
    isSystem: row.isSystem,
    fields: json<ContactOrigin["fields"]>(row.fields) || [],
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function mediaAssetFromRow(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    filename: row.filename,
    source: row.source as MediaAsset["source"],
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function pipelineStageFromRow(row: PipelineStageRow): PipelineStage {
  return {
    id: row.id,
    name: row.name,
    order: row.order,
    color: orUndef(row.color),
    companyId: row.companyId,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function dealFromRow(row: DealRow): Deal {
  return {
    id: row.id,
    title: row.title,
    contactId: row.contactId,
    stageId: row.stageId,
    value: orUndef(row.value),
    source: orUndef(row.source),
    assignedTo: orUndef(row.assignedTo),
    companyId: row.companyId,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function funnelEventFromRow(row: FunnelEventRow): FunnelEvent {
  return {
    id: row.id,
    dealId: row.dealId,
    fromStageId: orUndef(row.fromStageId),
    toStageId: row.toStageId,
    companyId: row.companyId,
    createdAt: ms(row.createdAt),
  };
}
