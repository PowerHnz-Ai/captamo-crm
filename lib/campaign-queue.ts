import { Prisma } from "@prisma/client";
import { getSql } from "./db";
import { campaignFromRow, campaignJobFromRow } from "./db-mappers";
import type { Campaign, CampaignJob, CampaignJobStatus, Contact } from "./types";
import { canSendMessages } from "./messaging-limits";
import {
  extractMessageStatus,
  extractResolvedWhatsAppId,
  normalizePhone,
} from "./whatsapp/phone";
import { getWhatsAppProvider, WhatsAppNotConfiguredError } from "./whatsapp";
import type { CompanyScope } from "./firestore-repositories";
import { findContactByPhone } from "./firestore-repositories";
import { persistOutboundTemplateMessage } from "./conversation-from-outbound";
import {
  buildJobScheduleTimestamps,
  getTodayDateKey,
  isInQuietPeriod,
  adjustToSendWindow,
} from "./campaign-cadence";
import { buildCampaignParametersAsync } from "./campaign-params-server";
import { resolveHeaderImage } from "./campaign-header-image";
import { isMessageStatusMoreAdvanced } from "./campaign-status-sync";

/** JSON opcional para escrita no Prisma (undefined = não altera a coluna). */
function j(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null
    ? undefined
    : (value as Prisma.InputJsonValue);
}

function jobUpdateData(data: Partial<CampaignJob>): Prisma.CampaignJobUpdateManyMutationInput {
  return {
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.scheduledAt !== undefined
      ? { scheduledAt: new Date(data.scheduledAt) }
      : {}),
    ...(data.attempts !== undefined ? { attempts: data.attempts } : {}),
    ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
    ...(data.whatsappMessageId !== undefined
      ? { whatsappMessageId: data.whatsappMessageId }
      : {}),
    ...(data.deliveryPhone !== undefined
      ? { deliveryPhone: data.deliveryPhone }
      : {}),
    ...(data.messageStatus !== undefined
      ? { messageStatus: data.messageStatus }
      : {}),
    ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
    ...(data.parameters !== undefined
      ? { parameters: data.parameters as Prisma.InputJsonValue }
      : {}),
  };
}

export interface CampaignQueue {
  enqueueJobs(
    campaignId: string,
    jobs: Omit<CampaignJob, "id" | "createdAt" | "updatedAt" | "attempts">[]
  ): Promise<void>;
  getPendingJobs(
    campaignId: string,
    limit: number
  ): Promise<CampaignJob[]>;
  claimPendingJobs(
    campaignId: string,
    limit: number
  ): Promise<CampaignJob[]>;
  updateJob(
    campaignId: string,
    jobId: string,
    data: Partial<CampaignJob>
  ): Promise<void>;
  updateJobIf(
    campaignId: string,
    jobId: string,
    expectedStatus: CampaignJobStatus,
    data: Partial<CampaignJob>
  ): Promise<boolean>;
  incrementCampaignCounters(
    campaignId: string,
    delta: { sent?: number; failed?: number; skipped?: number }
  ): Promise<void>;
}

class SqlCampaignQueue implements CampaignQueue {
  async enqueueJobs(
    campaignId: string,
    jobs: Omit<CampaignJob, "id" | "createdAt" | "updatedAt" | "attempts">[]
  ): Promise<void> {
    if (jobs.length === 0) return;
    const sql = getSql();
    const campaign = await sql.campaign.findUnique({
      where: { id: campaignId },
      select: { companyId: true },
    });
    if (!campaign) throw new Error("Campanha não encontrada.");

    await sql.campaignJob.createMany({
      data: jobs.map((job) => ({
        campaignId,
        companyId: campaign.companyId,
        contactId: job.contactId,
        phone: job.phone,
        contactName: job.contactName,
        parameters: job.parameters as Prisma.InputJsonValue,
        headerImageStoragePath: job.headerImageStoragePath,
        headerImageLink: job.headerImageLink,
        status: job.status,
        scheduledAt: new Date(job.scheduledAt),
        attempts: 0,
        ...(job.whatsappMessageId
          ? { whatsappMessageId: job.whatsappMessageId }
          : {}),
        ...(job.deliveryPhone ? { deliveryPhone: job.deliveryPhone } : {}),
        ...(job.messageStatus ? { messageStatus: job.messageStatus } : {}),
        ...(job.lastError ? { lastError: job.lastError } : {}),
      })),
    });
  }

  async getPendingJobs(
    campaignId: string,
    limit: number
  ): Promise<CampaignJob[]> {
    const rows = await getSql().campaignJob.findMany({
      where: {
        campaignId,
        status: "pending",
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });
    return rows.map(campaignJobFromRow);
  }

  /**
   * Reserva jobs vencidos de forma atômica (pending → processing): dois
   * runners simultâneos (cron + ação manual) nunca reservam o mesmo job.
   */
  async claimPendingJobs(
    campaignId: string,
    limit: number
  ): Promise<CampaignJob[]> {
    const sql = getSql();
    const candidates = await sql.campaignJob.findMany({
      where: {
        campaignId,
        status: "pending",
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });

    const claimed: CampaignJob[] = [];
    for (const row of candidates) {
      const res = await sql.campaignJob.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "processing" },
      });
      if (res.count === 1) {
        claimed.push(campaignJobFromRow({ ...row, status: "processing" }));
      }
    }
    return claimed;
  }

  async updateJob(
    campaignId: string,
    jobId: string,
    data: Partial<CampaignJob>
  ): Promise<void> {
    await getSql().campaignJob.updateMany({
      where: { id: jobId, campaignId },
      data: jobUpdateData(data),
    });
  }

  /** Atualiza só se o job ainda estiver no status esperado (guarda de corrida). */
  async updateJobIf(
    campaignId: string,
    jobId: string,
    expectedStatus: CampaignJobStatus,
    data: Partial<CampaignJob>
  ): Promise<boolean> {
    const res = await getSql().campaignJob.updateMany({
      where: { id: jobId, campaignId, status: expectedStatus },
      data: jobUpdateData(data),
    });
    return res.count === 1;
  }

  async incrementCampaignCounters(
    campaignId: string,
    delta: { sent?: number; failed?: number; skipped?: number }
  ): Promise<void> {
    await getSql().campaign.update({
      where: { id: campaignId },
      data: {
        ...(delta.sent ? { sentCount: { increment: delta.sent } } : {}),
        ...(delta.failed ? { failedCount: { increment: delta.failed } } : {}),
        ...(delta.skipped ? { skippedCount: { increment: delta.skipped } } : {}),
      },
    });
  }
}

export const campaignQueue: CampaignQueue = new SqlCampaignQueue();

/**
 * Total de jobs ainda não resolvidos da campanha, independente de scheduledAt.
 * Inclui "processing" para não marcar finished enquanto outro runner envia.
 */
export async function countPendingJobs(campaignId: string): Promise<number> {
  return getSql().campaignJob.count({
    where: { campaignId, status: { in: ["pending", "processing"] } },
  });
}

const STALE_PROCESSING_MS = 10 * 60_000;

/**
 * Jobs presos em "processing" (crash no meio do lote) voltam a "pending"
 * depois de 10 minutos para serem reprocessados.
 */
export async function resetStaleProcessingJobs(
  campaignId: string
): Promise<number> {
  const res = await getSql().campaignJob.updateMany({
    where: {
      campaignId,
      status: "processing",
      updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
    },
    data: {
      status: "pending",
      lastError: "Recuperado de processamento interrompido.",
    },
  });
  return res.count;
}

const MAX_JOB_ATTEMPTS = 3;
const INTRA_BATCH_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempts: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

export async function updateCampaignJobMessageStatus(
  whatsappMessageId: string,
  messageStatus: string
): Promise<void> {
  const sql = getSql();
  const rows = await sql.campaignJob.findMany({
    where: { whatsappMessageId },
    take: 5,
  });

  if (rows.length === 0) {
    console.warn("[campaign-queue] Job não encontrado para whatsappMessageId:", whatsappMessageId);
    return;
  }

  for (const row of rows) {
    if (!isMessageStatusMoreAdvanced(messageStatus, row.messageStatus ?? undefined)) {
      continue;
    }
    await sql.campaignJob.update({
      where: { id: row.id },
      data: {
        messageStatus,
        ...(messageStatus === "failed"
          ? { status: "failed" satisfies CampaignJobStatus }
          : {}),
      },
    });
  }
}

export async function cancelPendingJobsForContact(
  contactId: string,
  scope: CompanyScope
): Promise<number> {
  const result = await getSql().campaignJob.updateMany({
    where: {
      contactId,
      status: "pending",
      companyId: scope.companyId,
    },
    data: {
      status: "skipped",
      lastError: "Opt-out ou bloqueio do contato.",
    },
  });
  return result.count;
}

export async function createCampaign(
  data: Omit<
    Campaign,
    "id" | "createdAt" | "updatedAt" | "sentCount" | "failedCount" | "totalContacts"
  > & { totalContacts?: number },
  scope: CompanyScope
): Promise<Campaign> {
  const row = await getSql().campaign.create({
    data: {
      name: data.name,
      templateName: data.templateName,
      templateLanguage: data.templateLanguage,
      status: data.status,
      contactListId: data.contactListId,
      audienceType: data.audienceType,
      audienceConfig: j(data.audienceConfig),
      totalContacts: data.totalContacts ?? 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      maxSendsPerRun: data.maxSendsPerRun,
      parameterMapping: j(data.parameterMapping),
      contactOriginId: data.contactOriginId,
      contactOriginKey: data.contactOriginKey,
      dispatchMode: data.dispatchMode,
      cadenceConfig: j(data.cadenceConfig),
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      scheduledEndAt: data.scheduledEndAt
        ? new Date(data.scheduledEndAt)
        : undefined,
      dailySendLimit: data.dailySendLimit,
      dailySentDate: data.dailySentDate,
      dailySentCount: data.dailySentCount,
      quietHours: j(data.quietHours),
      duplicatePolicy: data.duplicatePolicy,
      excludeRecentDays: data.excludeRecentDays,
      excludeTags: j(data.excludeTags),
      excludeLeadClasses: j(data.excludeLeadClasses),
      importStats: j(data.importStats),
      headerImageAssetId: data.headerImageAssetId,
      headerImageStoragePath: data.headerImageStoragePath,
      headerImageMode: data.headerImageMode,
      headerImageMapping: data.headerImageMapping,
      companyId: scope.companyId,
    },
  });
  return campaignFromRow(row);
}

export async function getCampaign(
  id: string,
  scope: CompanyScope
): Promise<Campaign | null> {
  const row = await getSql().campaign.findFirst({
    where: { id, companyId: scope.companyId },
  });
  return row ? campaignFromRow(row) : null;
}

export async function listCampaigns(scope: CompanyScope): Promise<Campaign[]> {
  const rows = await getSql().campaign.findMany({
    where: { companyId: scope.companyId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(campaignFromRow);
}

export async function listCampaignJobs(
  campaignId: string,
  scope: CompanyScope
): Promise<CampaignJob[]> {
  const campaign = await getCampaign(campaignId, scope);
  if (!campaign) return [];

  const rows = await getSql().campaignJob.findMany({
    where: { campaignId },
  });
  return rows.map(campaignJobFromRow);
}

export async function updateCampaignStatus(
  id: string,
  status: Campaign["status"],
  scope: CompanyScope
): Promise<void> {
  const campaign = await getCampaign(id, scope);
  if (!campaign) throw new Error("Campanha não encontrada.");
  await getSql().campaign.update({
    where: { id },
    data: { status },
  });
}

export async function enqueueCampaignJobsForContacts(
  campaignId: string,
  campaign: Campaign,
  contacts: Contact[],
  mapping: string[],
  scope: CompanyScope,
  contactRefFieldKeys?: Set<string>
): Promise<void> {
  if (contacts.length === 0) return;

  const schedule = buildJobScheduleTimestamps(contacts.length, campaign);
  const effectiveMapping = mapping.length > 0 ? mapping : ["first_name"];

  const jobs = [];
  for (let index = 0; index < contacts.length; index++) {
    const contact = contacts[index]!;
    const parameters = await buildCampaignParametersAsync(
      contact,
      effectiveMapping,
      scope,
      contactRefFieldKeys
    );
    const headerImage = await resolveHeaderImage(contact, campaign, scope);
    jobs.push({
      contactId: contact.id,
      phone: contact.phone,
      contactName: contact.name,
      parameters,
      ...(headerImage?.storagePath
        ? { headerImageStoragePath: headerImage.storagePath }
        : {}),
      ...(headerImage?.link ? { headerImageLink: headerImage.link } : {}),
      status: "pending" as CampaignJobStatus,
      scheduledAt: schedule[index] ?? Date.now(),
    });
  }

  await campaignQueue.enqueueJobs(campaignId, jobs);
}

export async function updateCampaignFields(
  id: string,
  data: Partial<
    Pick<
      Campaign,
      | "name"
      | "templateName"
      | "templateLanguage"
      | "contactListId"
      | "maxSendsPerRun"
      | "parameterMapping"
      | "contactOriginId"
      | "contactOriginKey"
      | "totalContacts"
      | "audienceType"
      | "audienceConfig"
      | "dispatchMode"
      | "cadenceConfig"
      | "dailySendLimit"
      | "quietHours"
      | "duplicatePolicy"
      | "importStats"
      | "headerImageAssetId"
      | "headerImageStoragePath"
      | "headerImageMode"
      | "headerImageMapping"
    >
  > & {
    scheduledAt?: number | null;
    scheduledEndAt?: number | null;
    excludeRecentDays?: number | null;
  },
  scope: CompanyScope
): Promise<Campaign> {
  const campaign = await getCampaign(id, scope);
  if (!campaign) throw new Error("Campanha não encontrada.");
  if (campaign.status !== "draft") {
    throw new Error("Apenas campanhas em rascunho podem ser editadas.");
  }

  const patch: Prisma.CampaignUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.templateName !== undefined) patch.templateName = data.templateName;
  if (data.templateLanguage !== undefined) {
    patch.templateLanguage = data.templateLanguage;
  }
  if (data.contactListId !== undefined) patch.contactListId = data.contactListId;
  if (data.maxSendsPerRun !== undefined) patch.maxSendsPerRun = data.maxSendsPerRun;
  if (data.parameterMapping !== undefined) {
    patch.parameterMapping = data.parameterMapping as unknown as Prisma.InputJsonValue;
  }
  if (data.contactOriginId !== undefined) patch.contactOriginId = data.contactOriginId;
  if (data.contactOriginKey !== undefined) {
    patch.contactOriginKey = data.contactOriginKey;
  }
  if (data.totalContacts !== undefined) patch.totalContacts = data.totalContacts;
  if (data.audienceType !== undefined) patch.audienceType = data.audienceType;
  if (data.audienceConfig !== undefined) {
    patch.audienceConfig = data.audienceConfig as unknown as Prisma.InputJsonValue;
  }
  if (data.dispatchMode !== undefined) patch.dispatchMode = data.dispatchMode;
  if (data.cadenceConfig !== undefined) {
    patch.cadenceConfig = data.cadenceConfig as unknown as Prisma.InputJsonValue;
  }
  if (data.dailySendLimit !== undefined) patch.dailySendLimit = data.dailySendLimit;
  if (data.quietHours !== undefined) {
    patch.quietHours = data.quietHours as unknown as Prisma.InputJsonValue;
  }
  if (data.duplicatePolicy !== undefined) patch.duplicatePolicy = data.duplicatePolicy;
  if (data.importStats !== undefined) {
    patch.importStats = data.importStats as unknown as Prisma.InputJsonValue;
  }
  if (data.headerImageAssetId !== undefined) {
    patch.headerImageAssetId = data.headerImageAssetId;
  }
  if (data.headerImageStoragePath !== undefined) {
    patch.headerImageStoragePath = data.headerImageStoragePath;
  }
  if (data.headerImageMode !== undefined) patch.headerImageMode = data.headerImageMode;
  if (data.headerImageMapping !== undefined) {
    patch.headerImageMapping = data.headerImageMapping;
  }
  if (data.scheduledAt !== undefined) {
    patch.scheduledAt = data.scheduledAt === null ? null : new Date(data.scheduledAt);
  }
  if (data.scheduledEndAt !== undefined) {
    patch.scheduledEndAt =
      data.scheduledEndAt === null ? null : new Date(data.scheduledEndAt);
  }
  if (data.excludeRecentDays !== undefined) {
    patch.excludeRecentDays = data.excludeRecentDays;
  }

  await getSql().campaign.update({ where: { id }, data: patch });
  const updated = await getCampaign(id, scope);
  return updated!;
}

export async function deleteCampaignJobs(campaignId: string): Promise<void> {
  await getSql().campaignJob.deleteMany({ where: { campaignId } });
}

export async function deleteCampaign(
  id: string,
  scope: CompanyScope
): Promise<boolean> {
  const campaign = await getCampaign(id, scope);
  if (!campaign) return false;
  // Jobs caem por cascade.
  await getSql().campaign.delete({ where: { id } });
  return true;
}

export async function duplicateCampaign(
  id: string,
  scope: CompanyScope
): Promise<Campaign> {
  const original = await getCampaign(id, scope);
  if (!original) throw new Error("Campanha não encontrada.");

  const copy = await createCampaign(
    {
      name: `${original.name} (cópia)`,
      templateName: original.templateName,
      templateLanguage: original.templateLanguage,
      status: "draft",
      ...(original.contactListId ? { contactListId: original.contactListId } : {}),
      ...(original.audienceType ? { audienceType: original.audienceType } : {}),
      ...(original.audienceConfig ? { audienceConfig: original.audienceConfig } : {}),
      totalContacts: original.totalContacts || 0,
      skippedCount: 0,
      ...(original.maxSendsPerRun ? { maxSendsPerRun: original.maxSendsPerRun } : {}),
      ...(original.parameterMapping
        ? { parameterMapping: original.parameterMapping }
        : {}),
      ...(original.contactOriginId
        ? { contactOriginId: original.contactOriginId }
        : {}),
      ...(original.contactOriginKey
        ? { contactOriginKey: original.contactOriginKey }
        : {}),
      ...(original.dispatchMode ? { dispatchMode: original.dispatchMode } : {}),
      ...(original.cadenceConfig ? { cadenceConfig: original.cadenceConfig } : {}),
      ...(original.dailySendLimit ? { dailySendLimit: original.dailySendLimit } : {}),
      ...(original.quietHours ? { quietHours: original.quietHours } : {}),
      ...(original.duplicatePolicy
        ? { duplicatePolicy: original.duplicatePolicy }
        : {}),
      ...(original.excludeRecentDays
        ? { excludeRecentDays: original.excludeRecentDays }
        : {}),
      ...(original.headerImageAssetId
        ? { headerImageAssetId: original.headerImageAssetId }
        : {}),
      ...(original.headerImageStoragePath
        ? { headerImageStoragePath: original.headerImageStoragePath }
        : {}),
      ...(original.headerImageMode
        ? { headerImageMode: original.headerImageMode }
        : {}),
      ...(original.headerImageMapping
        ? { headerImageMapping: original.headerImageMapping }
        : {}),
    },
    scope
  );

  // Recria os jobs como pendentes a partir do público original.
  const jobRows = await getSql().campaignJob.findMany({
    where: { campaignId: id },
  });

  if (jobRows.length > 0) {
    const jobs = jobRows.map(campaignJobFromRow);
    const schedule = buildJobScheduleTimestamps(jobs.length, {
      ...original,
      dispatchMode: original.dispatchMode || "immediate",
    });
    await campaignQueue.enqueueJobs(
      copy.id,
      jobs.map((job, index) => ({
        contactId: job.contactId,
        phone: job.phone,
        contactName: job.contactName,
        parameters: job.parameters,
        ...(job.headerImageStoragePath
          ? { headerImageStoragePath: job.headerImageStoragePath }
          : {}),
        ...(job.headerImageLink ? { headerImageLink: job.headerImageLink } : {}),
        status: "pending" as CampaignJobStatus,
        scheduledAt: schedule[index] ?? Date.now(),
      }))
    );
  }

  return copy;
}

export async function runCampaignBatch(
  campaignId: string,
  scope: CompanyScope,
  batchSize = 20
): Promise<{ processed: number; sent: number; failed: number; paused: boolean }> {
  const campaign = await getCampaign(campaignId, scope);
  if (!campaign) throw new Error("Campanha não encontrada.");
  if (campaign.status !== "running") {
    throw new Error("Campanha não está em execução.");
  }

  if (campaign.scheduledEndAt) {
    const endMs = campaign.scheduledEndAt;
    if (endMs > 0 && Date.now() >= endMs) {
      await updateCampaignStatus(campaignId, "finished", scope);
      return { processed: 0, sent: 0, failed: 0, paused: false };
    }
  }

  if (isInQuietPeriod(new Date(), campaign.quietHours)) {
    return { processed: 0, sent: 0, failed: 0, paused: false };
  }

  const tz = campaign.quietHours?.timezone || "America/Sao_Paulo";
  const todayKey = getTodayDateKey(tz);
  let dailySent = 0;
  if (campaign.dailySentDate === todayKey) {
    dailySent = campaign.dailySentCount || 0;
  }

  if (campaign.dailySendLimit && dailySent >= campaign.dailySendLimit) {
    return { processed: 0, sent: 0, failed: 0, paused: false };
  }

  const limit = campaign.maxSendsPerRun || batchSize;
  const dailyRemaining = campaign.dailySendLimit
    ? campaign.dailySendLimit - dailySent
    : limit;
  const effectiveLimit = Math.min(limit, dailyRemaining);

  const check = await canSendMessages(scope.companyId, effectiveLimit);
  if (!check.allowed) {
    await updateCampaignStatus(campaignId, "paused", scope);
    return { processed: 0, sent: 0, failed: 0, paused: true };
  }

  await resetStaleProcessingJobs(campaignId);

  const actualBatch = Math.min(effectiveLimit, check.status.remaining);
  const jobs = await campaignQueue.claimPendingJobs(campaignId, actualBatch);
  const provider = await getWhatsAppProvider(scope.companyId);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      const phone = normalizePhone(job.phone);
      const existing = await findContactByPhone(phone, scope);
      if (existing?.blocked || existing?.optIn === false) {
        const ok = await campaignQueue.updateJobIf(campaignId, job.id, "processing", {
          status: "skipped" as CampaignJobStatus,
          lastError: "Contato bloqueado ou sem opt-in.",
        });
        if (ok) skipped++;
        continue;
      }

      const result = await provider.sendTemplate({
        to: phone,
        templateName: campaign.templateName,
        language: campaign.templateLanguage || "pt_BR",
        parameters: job.parameters,
        ...((job.headerImageStoragePath || job.headerImageLink)
          ? {
              headerImage: {
                ...(job.headerImageStoragePath
                  ? { storagePath: job.headerImageStoragePath }
                  : {}),
                ...(job.headerImageLink ? { link: job.headerImageLink } : {}),
              },
            }
          : {}),
      });

      const deliveryPhone =
        extractResolvedWhatsAppId(result.raw) || normalizePhone(phone);
      const messageStatus = extractMessageStatus(result.raw) || "accepted";

      await persistOutboundTemplateMessage({
        scope,
        phone: deliveryPhone,
        contactName: job.contactName || deliveryPhone,
        templateName: campaign.templateName,
        parameters: job.parameters,
        headerImageStoragePath: job.headerImageStoragePath,
        messageId: result.messageId,
        raw: result.raw,
        trackStats: true,
      });

      const ok = await campaignQueue.updateJobIf(campaignId, job.id, "processing", {
        status: "sent",
        whatsappMessageId: result.messageId,
        deliveryPhone,
        messageStatus,
        attempts: job.attempts + 1,
      });
      if (ok) {
        sent++;
      } else {
        console.warn(
          "[campaign-queue] Job mudou de status durante o envio (outro runner?):",
          job.id
        );
      }
    } catch (error) {
      // Empresa sem API configurada: devolve os jobs reservados e pausa a
      // campanha — não é falha transitória e não deve consumir tentativas.
      if (error instanceof WhatsAppNotConfiguredError) {
        await getSql().campaignJob.updateMany({
          where: { campaignId, status: "processing" },
          data: { status: "pending", lastError: error.message },
        });
        await updateCampaignStatus(campaignId, "paused", scope);
        await campaignQueue.incrementCampaignCounters(campaignId, {
          sent,
          failed,
          skipped,
        });
        return { processed: sent + failed + skipped, sent, failed, paused: true };
      }

      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      const nextAttempts = job.attempts + 1;
      const canRetry = nextAttempts < MAX_JOB_ATTEMPTS;

      if (canRetry) {
        const retryAt = adjustToSendWindow(
          Date.now() + retryDelayMs(nextAttempts),
          campaign.quietHours
        );
        await campaignQueue.updateJobIf(campaignId, job.id, "processing", {
          status: "pending",
          lastError: message,
          attempts: nextAttempts,
          scheduledAt: retryAt,
        });
      } else {
        const ok = await campaignQueue.updateJobIf(campaignId, job.id, "processing", {
          status: "failed",
          lastError: message,
          attempts: nextAttempts,
        });
        if (ok) failed++;
      }
    }

    if (INTRA_BATCH_DELAY_MS > 0) {
      await sleep(INTRA_BATCH_DELAY_MS);
    }
  }

  await campaignQueue.incrementCampaignCounters(campaignId, { sent, failed, skipped });

  if (sent > 0) {
    await getSql().campaign.update({
      where: { id: campaignId },
      data: {
        dailySentDate: todayKey,
        ...(campaign.dailySentDate === todayKey
          ? { dailySentCount: { increment: sent } }
          : { dailySentCount: sent }),
      },
    });
  }

  // Conclusão considera TODOS os pendentes, inclusive agendados para o futuro
  // (cadência/retry) — getPendingJobs filtra só os vencidos e marcaria
  // "finished" prematuramente, orfanando os jobs futuros.
  const remaining = await countPendingJobs(campaignId);
  if (remaining === 0) {
    await updateCampaignStatus(campaignId, "finished", scope);
    try {
      const { applyAutoClass4ForFinishedCampaign } = await import("./lead-class-auto");
      await applyAutoClass4ForFinishedCampaign(campaignId, scope);
    } catch (err) {
      console.error("[campaign-queue] auto lead class failed", err);
    }
  }

  return { processed: jobs.length, sent, failed, paused: false };
}

const DEFAULT_MAX_BATCHES_PER_RUN = 5;

export async function runCampaignBatches(
  campaignId: string,
  scope: CompanyScope,
  options?: { maxBatches?: number; batchSize?: number }
): Promise<{
  sent: number;
  failed: number;
  paused: boolean;
  batchesRun: number;
  processed: number;
}> {
  const maxBatches = options?.maxBatches ?? DEFAULT_MAX_BATCHES_PER_RUN;
  let sent = 0;
  let failed = 0;
  let processed = 0;
  let paused = false;
  let batchesRun = 0;

  for (let i = 0; i < maxBatches; i++) {
    const campaign = await getCampaign(campaignId, scope);
    if (!campaign || campaign.status !== "running") break;

    const pending = await campaignQueue.getPendingJobs(campaignId, 1);
    if (pending.length === 0) break;

    const result = await runCampaignBatch(
      campaignId,
      scope,
      options?.batchSize
    );
    batchesRun++;
    sent += result.sent;
    failed += result.failed;
    processed += result.processed;

    if (result.paused) {
      paused = true;
      break;
    }
    if (result.processed === 0) break;
  }

  return { sent, failed, paused, batchesRun, processed };
}
