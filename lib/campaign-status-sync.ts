import type { MessageStatus } from "./types";
import type { CompanyScope } from "./firestore-repositories";

const STATUS_RANK: Record<string, number> = {
  received: 0,
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: -1,
};

function normalizeStatus(status?: string): string {
  return (status || "accepted").toLowerCase();
}

export function isMessageStatusMoreAdvanced(
  next: string | undefined,
  current: string | undefined
): boolean {
  const nextNorm = normalizeStatus(next);
  const currentNorm = normalizeStatus(current);
  if (nextNorm === "failed") return currentNorm !== "failed";
  const nextRank = STATUS_RANK[nextNorm] ?? 0;
  const currentRank = STATUS_RANK[currentNorm] ?? 0;
  return nextRank > currentRank;
}

export async function syncCampaignJobStatuses(
  campaignId: string,
  scope: CompanyScope
): Promise<{ updated: number }> {
  const { listCampaignJobs, campaignQueue } = await import("./campaign-queue");
  const { getConversationMessage } = await import("./firestore-repositories");
  const { resolveWhatsAppMessageRef } = await import("./whatsapp-message-refs");

  const jobs = await listCampaignJobs(campaignId, scope);
  let updated = 0;

  for (const job of jobs) {
    if (job.status !== "sent" || !job.whatsappMessageId) continue;

    const ref = await resolveWhatsAppMessageRef(job.whatsappMessageId);
    if (!ref || ref.companyId !== scope.companyId) continue;

    const message = await getConversationMessage(
      ref.conversationId,
      ref.messageId,
      scope
    );
    if (!message?.status) continue;

    const messageStatus = message.status as MessageStatus;
    if (messageStatus === "failed") {
      if (job.messageStatus !== "failed") {
        await campaignQueue.updateJob(campaignId, job.id, {
          messageStatus: "failed",
          status: "failed",
          lastError: message.statusError || job.lastError,
        });
        updated++;
      }
      continue;
    }

    if (isMessageStatusMoreAdvanced(messageStatus, job.messageStatus)) {
      await campaignQueue.updateJob(campaignId, job.id, {
        messageStatus,
      });
      updated++;
    }
  }

  return { updated };
}

export async function syncCampaignJobByWhatsappMessageId(
  whatsappMessageId: string,
  messageStatus: string,
  scope: CompanyScope
): Promise<void> {
  const { resolveWhatsAppMessageRef } = await import("./whatsapp-message-refs");
  const { getSql } = await import("./db");

  const ref = await resolveWhatsAppMessageRef(whatsappMessageId);
  if (!ref || ref.companyId !== scope.companyId) return;

  const sql = getSql();
  const rows = await sql.campaignJob.findMany({
    where: { whatsappMessageId, companyId: scope.companyId },
    take: 5,
  });

  for (const row of rows) {
    if (!isMessageStatusMoreAdvanced(messageStatus, row.messageStatus ?? undefined)) {
      continue;
    }
    await sql.campaignJob.update({
      where: { id: row.id },
      data: {
        messageStatus,
        ...(messageStatus === "failed" ? { status: "failed" } : {}),
      },
    });
  }
}
