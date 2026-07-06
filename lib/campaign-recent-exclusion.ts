import type { Contact } from "./types";
import type { CompanyScope } from "./firestore-repositories";

export async function getRecentlyTargetedContactIds(
  scope: CompanyScope,
  days: number,
  options?: { excludeCampaignId?: string }
): Promise<Set<string>> {
  if (days < 1) return new Set();

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffMs);
  const { getSql } = await import("./db");

  const rows = await getSql().campaignJob.findMany({
    where: {
      companyId: scope.companyId,
      status: { in: ["sent", "pending", "processing"] },
      ...(options?.excludeCampaignId
        ? { campaignId: { not: options.excludeCampaignId } }
        : {}),
      // Campanhas antigas e inativas não contam como participação recente.
      campaign: {
        OR: [
          { createdAt: { gte: cutoff } },
          { status: { in: ["running", "paused"] } },
        ],
      },
    },
    select: {
      contactId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const contactIds = new Set<string>();
  for (const job of rows) {
    const participationMs =
      job.status === "sent"
        ? (job.updatedAt ?? job.createdAt).getTime()
        : job.createdAt.getTime();
    if (participationMs < cutoffMs) continue;
    if (!job.contactId) continue;
    contactIds.add(job.contactId);
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
