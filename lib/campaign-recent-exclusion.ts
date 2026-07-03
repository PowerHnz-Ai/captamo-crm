import type { Contact, CampaignJob } from "./types";
import type { CompanyScope } from "./firestore-repositories";

const PARTICIPATION_STATUSES = new Set(["sent", "pending"]);

function jobParticipationMs(job: CampaignJob): number {
  if (job.status === "sent") {
    return job.updatedAt?.toMillis?.() ?? job.createdAt?.toMillis?.() ?? 0;
  }
  return job.createdAt?.toMillis?.() ?? 0;
}

function isRelevantCampaign(
  campaign: { id: string; createdAt?: { toMillis?: () => number }; status?: string },
  cutoffMs: number
): boolean {
  const createdMs = campaign.createdAt?.toMillis?.() ?? 0;
  if (createdMs >= cutoffMs) return true;
  return campaign.status === "running" || campaign.status === "paused";
}

export async function getRecentlyTargetedContactIds(
  scope: CompanyScope,
  days: number,
  options?: { excludeCampaignId?: string }
): Promise<Set<string>> {
  if (days < 1) return new Set();

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const { listCampaigns } = await import("./campaign-queue");
  const { getDb } = await import("./firebase-admin");

  const campaigns = await listCampaigns(scope);
  const contactIds = new Set<string>();

  for (const campaign of campaigns) {
    if (options?.excludeCampaignId && campaign.id === options.excludeCampaignId) {
      continue;
    }
    if (!isRelevantCampaign(campaign, cutoffMs)) continue;

    const snap = await getDb()
      .collection("campaigns")
      .doc(campaign.id)
      .collection("jobs")
      .get();

    for (const doc of snap.docs) {
      const job = doc.data() as CampaignJob;
      if (!PARTICIPATION_STATUSES.has(job.status)) continue;
      if (!job.contactId) continue;
      if (jobParticipationMs(job) < cutoffMs) continue;
      contactIds.add(job.contactId);
    }
  }

  return contactIds;
}

export function filterContactsByRecentExclusion(
  contacts: Contact[],
  excludedIds: Set<string>
): { contacts: Contact[]; excludedCount: number } {
  if (excludedIds.size === 0) {
    return { contacts, excludedCount: 0 };
  }

  const filtered = contacts.filter((c) => !excludedIds.has(c.id));
  return {
    contacts: filtered,
    excludedCount: contacts.length - filtered.length,
  };
}
