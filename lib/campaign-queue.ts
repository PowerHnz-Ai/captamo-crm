import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { Campaign, CampaignJob, CampaignJobStatus, Contact } from "./types";
import { canSendMessages } from "./messaging-limits";
import {
  extractMessageStatus,
  extractResolvedWhatsAppId,
  normalizePhone,
} from "./whatsapp/phone";
import { getWhatsAppProvider } from "./whatsapp";
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

function nowTimestamp() {
  return Timestamp.now();
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
  updateJob(
    campaignId: string,
    jobId: string,
    data: Partial<CampaignJob>
  ): Promise<void>;
  incrementCampaignCounters(
    campaignId: string,
    delta: { sent?: number; failed?: number; skipped?: number }
  ): Promise<void>;
}

class FirestoreCampaignQueue implements CampaignQueue {
  async enqueueJobs(
    campaignId: string,
    jobs: Omit<CampaignJob, "id" | "createdAt" | "updatedAt" | "attempts">[]
  ): Promise<void> {
    const batch = getDb().batch();
    const col = getDb()
      .collection("campaigns")
      .doc(campaignId)
      .collection("jobs");

    for (const job of jobs) {
      const ref = col.doc();
      const ts = nowTimestamp();
      batch.set(ref, {
        id: ref.id,
        ...job,
        attempts: 0,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    await batch.commit();
  }

  async getPendingJobs(
    campaignId: string,
    limit: number
  ): Promise<CampaignJob[]> {
    const snap = await getDb()
      .collection("campaigns")
      .doc(campaignId)
      .collection("jobs")
      .where("status", "==", "pending")
      .get();

    const jobs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CampaignJob);
    const nowMs = Date.now();
    const due = jobs.filter((job) => {
      const scheduledMs = job.scheduledAt?.toMillis?.() ?? 0;
      return scheduledMs <= nowMs;
    });
    due.sort((a, b) => {
      const aMs = a.scheduledAt?.toMillis?.() ?? 0;
      const bMs = b.scheduledAt?.toMillis?.() ?? 0;
      return aMs - bMs;
    });
    return due.slice(0, limit);
  }

  async updateJob(
    campaignId: string,
    jobId: string,
    data: Partial<CampaignJob>
  ): Promise<void> {
    await getDb()
      .collection("campaigns")
      .doc(campaignId)
      .collection("jobs")
      .doc(jobId)
      .update({ ...data, updatedAt: nowTimestamp() });
  }

  async incrementCampaignCounters(
    campaignId: string,
    delta: { sent?: number; failed?: number; skipped?: number }
  ): Promise<void> {
    const { FieldValue } = await import("firebase-admin/firestore");
    const patch: Record<string, unknown> = { updatedAt: nowTimestamp() };
    if (delta.sent) patch.sentCount = FieldValue.increment(delta.sent);
    if (delta.failed) patch.failedCount = FieldValue.increment(delta.failed);
    if (delta.skipped) patch.skippedCount = FieldValue.increment(delta.skipped);
    await getDb().collection("campaigns").doc(campaignId).update(patch);
  }
}

export const campaignQueue: CampaignQueue = new FirestoreCampaignQueue();

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
  const snap = await getDb()
    .collectionGroup("jobs")
    .where("whatsappMessageId", "==", whatsappMessageId)
    .limit(5)
    .get();

  if (snap.empty) {
    console.warn("[campaign-queue] Job não encontrado para whatsappMessageId:", whatsappMessageId);
    return;
  }

  const batch = getDb().batch();
  for (const doc of snap.docs) {
    const job = doc.data();
    if (!isMessageStatusMoreAdvanced(messageStatus, job.messageStatus)) continue;
    batch.update(doc.ref, {
      messageStatus,
      updatedAt: nowTimestamp(),
      ...(messageStatus === "failed" ? { status: "failed" as CampaignJobStatus } : {}),
    });
  }
  await batch.commit();
}

export async function cancelPendingJobsForContact(
  contactId: string,
  scope: CompanyScope
): Promise<number> {
  const snap = await getDb()
    .collectionGroup("jobs")
    .where("contactId", "==", contactId)
    .where("status", "==", "pending")
    .get();

  if (snap.empty) return 0;

  const batch = getDb().batch();
  let cancelled = 0;

  for (const doc of snap.docs) {
    const campaignRef = doc.ref.parent.parent;
    if (!campaignRef) continue;
    const campaignDoc = await campaignRef.get();
    const campaign = campaignDoc.data() as Campaign | undefined;
    if (campaign?.companyId !== scope.companyId) continue;

    batch.update(doc.ref, {
      status: "skipped",
      lastError: "Opt-out ou bloqueio do contato.",
      updatedAt: nowTimestamp(),
    });
    cancelled++;
  }

  if (cancelled > 0) await batch.commit();
  return cancelled;
}

export async function createCampaign(
  data: Omit<
    Campaign,
    "id" | "createdAt" | "updatedAt" | "sentCount" | "failedCount" | "totalContacts"
  > & { totalContacts?: number },
  scope: CompanyScope
): Promise<Campaign> {
  const ts = nowTimestamp();
  const ref = getDb().collection("campaigns").doc();
  const campaign: Omit<Campaign, "id"> = {
    ...data,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    totalContacts: data.totalContacts ?? 0,
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...campaign });
  return { id: ref.id, ...campaign };
}

export async function getCampaign(
  id: string,
  scope: CompanyScope
): Promise<Campaign | null> {
  const doc = await getDb().collection("campaigns").doc(id).get();
  if (!doc.exists) return null;
  const campaign = { id: doc.id, ...doc.data() } as Campaign;
  if (campaign.companyId !== scope.companyId) return null;
  return campaign;
}

export async function listCampaigns(scope: CompanyScope): Promise<Campaign[]> {
  const snap = await getDb()
    .collection("campaigns")
    .where("companyId", "==", scope.companyId)
    .get();

  const campaigns = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Campaign);
  campaigns.sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
  return campaigns;
}

export async function listCampaignJobs(
  campaignId: string,
  scope: CompanyScope
): Promise<CampaignJob[]> {
  const campaign = await getCampaign(campaignId, scope);
  if (!campaign) return [];

  const snap = await getDb()
    .collection("campaigns")
    .doc(campaignId)
    .collection("jobs")
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CampaignJob);
}

export async function updateCampaignStatus(
  id: string,
  status: Campaign["status"],
  scope: CompanyScope
): Promise<void> {
  const campaign = await getCampaign(id, scope);
  if (!campaign) throw new Error("Campanha não encontrada.");
  await getDb().collection("campaigns").doc(id).update({
    status,
    updatedAt: nowTimestamp(),
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
      scheduledAt: Timestamp.fromMillis(schedule[index] ?? Date.now()),
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
    scheduledAt?: Timestamp | null;
    scheduledEndAt?: Timestamp | null;
    excludeRecentDays?: number | null;
  },
  scope: CompanyScope
): Promise<Campaign> {
  const campaign = await getCampaign(id, scope);
  if (!campaign) throw new Error("Campanha não encontrada.");
  if (campaign.status !== "draft") {
    throw new Error("Apenas campanhas em rascunho podem ser editadas.");
  }

  const { FieldValue } = await import("firebase-admin/firestore");
  const patch: Record<string, unknown> = { updatedAt: nowTimestamp() };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === "scheduledAt" && value === null) {
      patch.scheduledAt = FieldValue.delete();
    } else if (key === "scheduledEndAt" && value === null) {
      patch.scheduledEndAt = FieldValue.delete();
    } else if (key === "excludeRecentDays" && value === null) {
      patch.excludeRecentDays = FieldValue.delete();
    } else {
      patch[key] = value;
    }
  }

  await getDb().collection("campaigns").doc(id).update(patch);
  const updated = await getCampaign(id, scope);
  return updated!;
}

export async function deleteCampaignJobs(campaignId: string): Promise<void> {
  const col = getDb()
    .collection("campaigns")
    .doc(campaignId)
    .collection("jobs");
  const snap = await col.get();
  if (snap.empty) return;

  // Firestore limita 500 operações por batch.
  let batch = getDb().batch();
  let count = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 450 === 0) {
      await batch.commit();
      batch = getDb().batch();
    }
  }
  await batch.commit();
}

export async function deleteCampaign(
  id: string,
  scope: CompanyScope
): Promise<boolean> {
  const campaign = await getCampaign(id, scope);
  if (!campaign) return false;
  await deleteCampaignJobs(id);
  await getDb().collection("campaigns").doc(id).delete();
  return true;
}

export async function duplicateCampaign(
  id: string,
  scope: CompanyScope
): Promise<Campaign> {
  const original = await getCampaign(id, scope);
  if (!original) throw new Error("Campanha não encontrada.");

  const ts = nowTimestamp();
  const ref = getDb().collection("campaigns").doc();
  const copy: Omit<Campaign, "id"> = {
    name: `${original.name} (cópia)`,
    templateName: original.templateName,
    templateLanguage: original.templateLanguage,
    status: "draft",
    ...(original.contactListId ? { contactListId: original.contactListId } : {}),
    ...(original.audienceType ? { audienceType: original.audienceType } : {}),
    ...(original.audienceConfig ? { audienceConfig: original.audienceConfig } : {}),
    totalContacts: original.totalContacts || 0,
    sentCount: 0,
    failedCount: 0,
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
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...copy });

  // Recria os jobs como pendentes a partir do público original.
  const jobsSnap = await getDb()
    .collection("campaigns")
    .doc(id)
    .collection("jobs")
    .get();

  if (!jobsSnap.empty) {
    const jobs = jobsSnap.docs.map((doc) => doc.data() as CampaignJob);
    const schedule = buildJobScheduleTimestamps(jobs.length, {
      ...original,
      dispatchMode: original.dispatchMode || "immediate",
    });
    await campaignQueue.enqueueJobs(
      ref.id,
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
        scheduledAt: Timestamp.fromMillis(schedule[index] ?? ts.toMillis()),
      }))
    );
  }

  return { id: ref.id, ...copy };
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
    const endMs = campaign.scheduledEndAt.toMillis?.() ?? 0;
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

  const actualBatch = Math.min(effectiveLimit, check.status.remaining);
  const jobs = await campaignQueue.getPendingJobs(campaignId, actualBatch);
  const provider = await getWhatsAppProvider(scope.companyId);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      const phone = normalizePhone(job.phone);
      const existing = await findContactByPhone(phone, scope);
      if (existing?.blocked || existing?.optIn === false) {
        await campaignQueue.updateJob(campaignId, job.id, {
          status: "skipped" as CampaignJobStatus,
          lastError: "Contato bloqueado ou sem opt-in.",
        });
        skipped++;
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

      await campaignQueue.updateJob(campaignId, job.id, {
        status: "sent",
        whatsappMessageId: result.messageId,
        deliveryPhone,
        messageStatus,
        attempts: job.attempts + 1,
      });

      sent++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      const nextAttempts = job.attempts + 1;
      const canRetry = nextAttempts < MAX_JOB_ATTEMPTS;

      if (canRetry) {
        const retryAt = adjustToSendWindow(
          Date.now() + retryDelayMs(nextAttempts),
          campaign.quietHours
        );
        await campaignQueue.updateJob(campaignId, job.id, {
          status: "pending",
          lastError: message,
          attempts: nextAttempts,
          scheduledAt: Timestamp.fromMillis(retryAt),
        });
      } else {
        await campaignQueue.updateJob(campaignId, job.id, {
          status: "failed",
          lastError: message,
          attempts: nextAttempts,
        });
        failed++;
      }
    }

    if (INTRA_BATCH_DELAY_MS > 0) {
      await sleep(INTRA_BATCH_DELAY_MS);
    }
  }

  await campaignQueue.incrementCampaignCounters(campaignId, { sent, failed, skipped });

  if (sent > 0) {
    const { FieldValue } = await import("firebase-admin/firestore");
    const patch: Record<string, unknown> = {
      updatedAt: nowTimestamp(),
      dailySentCount: FieldValue.increment(sent),
      dailySentDate: todayKey,
    };
    if (campaign.dailySentDate !== todayKey) {
      patch.dailySentCount = sent;
    }
    await getDb().collection("campaigns").doc(campaignId).update(patch);
  }

  const remaining = await campaignQueue.getPendingJobs(campaignId, 1);
  if (remaining.length === 0) {
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
