import { z } from "zod";

export const sendTemplateSchema = z.object({
  to: z.string().min(10),
  templateName: z.string().min(1),
  language: z.string().min(2).default("pt_BR"),
  parameters: z.array(z.string()).default([]),
  parameterMapping: z.array(z.string()).optional(),
  headerImageAssetId: z.string().optional(),
  headerImageStoragePath: z.string().optional(),
  headerImageMode: z.enum(["fixed", "per_contact"]).optional(),
  headerImageMapping: z.string().optional(),
});

export const sendTextSchema = z.object({
  to: z.string().min(10),
  body: z.string().min(1).max(4096),
  includeSenderName: z.boolean().optional(),
  retryMessageId: z.string().min(1).optional(),
  /** Responde citando esta mensagem (id interno da mensagem). */
  replyToMessageId: z.string().min(1).optional(),
});

export const sendMediaSchema = z.object({
  to: z.string().min(10),
  type: z.enum(["image", "audio", "document"]),
  storagePath: z.string().min(1),
  mimeType: z.string().min(1),
  caption: z.string().max(1024).optional(),
  filename: z.string().max(200).optional(),
  retryMessageId: z.string().min(1).optional(),
  includeSenderName: z.boolean().optional(),
  /** Responde citando esta mensagem (id interno da mensagem). */
  replyToMessageId: z.string().min(1).optional(),
});

export const createQuickReplySchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(4096),
  scope: z.enum(["company", "personal"]).default("company"),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateQuickReplySchema = z.object({
  title: z.string().min(1).max(80).optional(),
  body: z.string().min(1).max(4096).optional(),
  scope: z.enum(["company", "personal"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  source: z.string().default("manual"),
  tags: z.array(z.string()).default([]),
  optIn: z.boolean().default(true),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  originId: z.string().optional(),
  originFields: z.record(z.string(), z.string()).optional(),
  leadClass: z.number().int().min(1).max(5).nullable().optional(),
});

export const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  optIn: z.boolean().optional(),
  blocked: z.boolean().optional(),
  archived: z.boolean().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  originId: z.string().optional(),
  originFields: z.record(z.string(), z.string()).optional(),
  leadClass: z.number().int().min(1).max(5).nullable().optional(),
});

export const importContactsSchema = z.object({
  contacts: z.array(createContactSchema).min(1),
  duplicatePolicy: z.enum(["tag_existing", "skip", "update"]).optional(),
});

const quietHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().default("America/Sao_Paulo"),
});

const cadenceConfigSchema = z.object({
  strategy: z.enum(["interval", "per_hour", "spread_until_end"]),
  intervalMinutes: z.number().min(1).max(1440).optional(),
  messagesPerHour: z.number().min(1).max(3600).optional(),
  messagesPerTick: z.number().min(1).max(100).optional(),
});

const audienceConfigSchema = z.object({
  tags: z.array(z.string()).optional(),
  contactListId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  spreadsheetTag: z.string().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
  originId: z.string().optional(),
  originFieldFilters: z.record(z.string(), z.string()).optional(),
  leadClasses: z.array(z.number().int().min(1).max(5)).optional(),
});

const campaignFieldsSchema = {
  audienceType: z
    .enum(["all", "tags", "list", "manual", "spreadsheet", "origin", "classes"])
    .optional(),
  audienceConfig: audienceConfigSchema.optional(),
  contactOriginId: z.string().optional(),
  contactOriginKey: z.string().optional(),
  headerImageAssetId: z.string().optional(),
  headerImageStoragePath: z.string().optional(),
  headerImageMode: z.enum(["fixed", "per_contact"]).optional(),
  headerImageMapping: z.string().optional(),
  dispatchMode: z.enum(["immediate", "cadence"]).default("immediate"),
  cadenceConfig: cadenceConfigSchema.optional(),
  scheduledEndAt: z.string().datetime().optional(),
  dailySendLimit: z.number().min(1).max(10000).optional(),
  quietHours: quietHoursSchema.optional(),
  duplicatePolicy: z.enum(["tag_existing", "skip", "update"]).optional(),
  excludeRecentDays: z.number().int().min(1).max(365).optional(),
  excludeTags: z.array(z.string()).optional(),
  excludeLeadClasses: z.array(z.number().int().min(1).max(5)).optional(),
  importStats: z
    .object({
      total: z.number(),
      imported: z.number(),
      skipped: z.number(),
      invalid: z.number(),
      updated: z.number().optional(),
    })
    .optional(),
};

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  templateName: z.string().min(1),
  templateLanguage: z.string().default("pt_BR"),
  contactListId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  maxSendsPerRun: z.number().min(1).max(100).default(20),
  parameterMapping: z.array(z.string()).default([]),
  scheduledAt: z.string().datetime().optional(),
  ...campaignFieldsSchema,
});

const uploadPreviewRowSchema = z.object({
  name: z.string(),
  phone: z.string(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  originId: z.string().optional(),
  originFields: z.record(z.string(), z.string()).optional(),
  leadClass: z.number().int().min(1).max(5).nullable().optional(),
});

export const previewCampaignSchema = z.object({
  contactListId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  originId: z.string().optional(),
  audienceConfig: audienceConfigSchema.optional(),
  audienceType: z.enum(["all", "tags", "list", "manual", "spreadsheet", "origin", "classes"]).optional(),
  uploadPreview: z
    .object({
      rows: z.array(uploadPreviewRowSchema).min(1),
    })
    .optional(),
  duplicatePolicy: z.enum(["tag_existing", "skip", "update"]).optional(),
  parameterMapping: z.array(z.string()).optional(),
  templateName: z.string().optional(),
  headerImageAssetId: z.string().optional(),
  headerImageStoragePath: z.string().optional(),
  headerImageMode: z.enum(["fixed", "per_contact"]).optional(),
  headerImageMapping: z.string().optional(),
  excludeRecentDays: z.number().int().min(1).max(365).optional(),
  excludeTags: z.array(z.string()).optional(),
  excludeLeadClasses: z.array(z.number().int().min(1).max(5)).optional(),
});

export const importCampaignContactsSchema = z.object({
  tag: z.string().min(1),
  contacts: z.array(
    z.object({
      name: z.string(),
      phone: z.string().min(10),
      tags: z.array(z.string()).default([]),
      customFields: z.record(z.string(), z.string()).optional(),
      originId: z.string().optional(),
      originFields: z.record(z.string(), z.string()).optional(),
    })
  ).min(1),
  originId: z.string().optional(),
  duplicatePolicy: z.enum(["tag_existing", "skip", "update"]).default("tag_existing"),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  templateName: z.string().min(1).optional(),
  templateLanguage: z.string().optional(),
  contactListId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  maxSendsPerRun: z.number().min(1).max(100).optional(),
  parameterMapping: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  ...campaignFieldsSchema,
  excludeRecentDays: z.number().int().min(1).max(365).nullable().optional(),
  excludeTags: z.array(z.string()).nullable().optional(),
  excludeLeadClasses: z.array(z.number().int().min(1).max(5)).nullable().optional(),
  scheduledEndAt: z.string().datetime().nullable().optional(),
});

export const createContactListSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tagFilter: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
});

export const updateContactListSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  tagFilter: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
});

const templateHeaderSchema = z.object({
  type: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]),
  text: z.string().optional(),
  mediaUrl: z.string().optional(),
  storagePath: z.string().optional(),
  mediaAssetId: z.string().optional(),
});

const templateButtonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_REPLY"), text: z.string().min(1) }),
  z.object({ type: z.literal("URL"), text: z.string().min(1), url: z.string().url() }),
  z.object({ type: z.literal("PHONE_NUMBER"), text: z.string().min(1), phone: z.string().min(8) }),
  z.object({ type: z.literal("COPY_CODE"), text: z.string().min(1) }),
]);

export const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
  language: z.string().default("pt_BR"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("UTILITY"),
  body: z.string().min(1),
  header: templateHeaderSchema.optional(),
  variableSamples: z.array(z.string()).default([]),
  footer: z.string().max(60).optional(),
  buttons: z.array(templateButtonSchema).max(3).optional(),
  requiresMetaApproval: z.boolean().default(true),
});

export const updateTemplateSchema = z.object({
  language: z.string().optional(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  body: z.string().min(1).optional(),
  header: templateHeaderSchema.optional(),
  variableSamples: z.array(z.string()).optional(),
  footer: z.string().max(60).optional(),
  buttons: z.array(templateButtonSchema).max(3).optional(),
  requiresMetaApproval: z.boolean().optional(),
});

export const createContactOriginSchema = z.object({
  label: z.string().min(1),
  fields: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(["month", "text", "phone", "contact_ref"]),
      required: z.boolean().optional(),
    })
  ),
});

export const updateContactOriginSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  fields: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(["month", "text", "phone", "contact_ref"]),
        required: z.boolean().optional(),
      })
    )
    .optional(),
});

export const updateTeamUserSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(["admin", "gerente", "leader", "member"]).nullable().optional(),
  name: z.string().min(1).max(120).optional(),
  username: z.string().min(1).max(40).nullable().optional(),
  jobTitle: z.string().max(80).nullable().optional(),
});

export const createTeamMemberSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  role: z.enum(["admin", "gerente", "leader", "member"]),
});

export const createClientSchema = z.object({
  companyName: z.string().min(1).max(160),
  managerName: z.string().min(1).max(120),
  managerEmail: z.string().email().max(160),
});

/** Credenciais da API oficial por clínica (só platform admin). */
export const platformWhatsappConfigSchema = z.object({
  token: z.string().min(20).max(1000),
  phoneNumberId: z.string().min(5).max(64),
  wabaId: z.string().min(5).max(64),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  username: z.string().min(1).max(40).nullable().optional(),
  jobTitle: z.string().max(80).nullable().optional(),
});

export const createDealSchema = z.object({
  title: z.string().min(1),
  contactId: z.string().min(1),
  stageId: z.string().min(1),
  value: z.number().optional(),
  source: z.string().optional(),
});

export const moveDealSchema = z.object({
  stageId: z.string().min(1),
});

export const updateIntegrationSchema = z.object({
  provider: z.enum(["meta_cloud", "evolution"]),
  phoneNumberId: z.string().optional(),
  wabaId: z.string().optional(),
  instanceId: z.string().optional(),
  apiKeyRef: z.string().optional(),
  dailyCap: z.number().optional(),
  baseUrl: z.string().optional(),
});

export const createConnectionSchema = z.object({
  label: z.string().min(1).max(60),
  provider: z.enum(["meta_cloud", "evolution"]),
  baseUrl: z.string().optional(),
  instanceId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  wabaId: z.string().optional(),
});
