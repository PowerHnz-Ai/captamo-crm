import { getDb } from "./firebase-admin";
import type { CompanyScope } from "./firestore-repositories";
import {
  getCampaign,
  listCampaigns,
  runCampaignBatches,
  updateCampaignStatus,
} from "./campaign-queue";

const BATCH_SIZE = 20;
const MAX_CAMPAIGNS_PER_TICK = 5;

export async function processRunningCampaigns(
  scope: CompanyScope
): Promise<{
  campaignsProcessed: number;
  totalSent: number;
  totalFailed: number;
  paused: string[];
}> {
  const campaigns = (await listCampaigns(scope)).filter((c) => c.status === "running");
  const due = campaigns
    .filter((c) => {
      if (!c.scheduledAt) return true;
      const ms = c.scheduledAt.toMillis?.() ?? 0;
      return ms <= Date.now();
    })
    .slice(0, MAX_CAMPAIGNS_PER_TICK);

  let totalSent = 0;
  let totalFailed = 0;
  const paused: string[] = [];

  for (const campaign of due) {
    const result = await runCampaignBatches(campaign.id, scope, {
      batchSize: BATCH_SIZE,
    });
    totalSent += result.sent;
    totalFailed += result.failed;
    if (result.paused) paused.push(campaign.id);
  }

  return {
    campaignsProcessed: due.length,
    totalSent,
    totalFailed,
    paused,
  };
}

export async function processAllCompaniesRunningCampaigns(): Promise<void> {
  const snap = await getDb().collection("campaigns").where("status", "==", "running").get();
  const companyIds = [
    ...new Set(
      snap.docs
        .map((doc) => (doc.data() as { companyId?: string }).companyId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  for (const companyId of companyIds) {
    await processRunningCampaigns({ companyId });
  }
}

export async function scheduleCampaignIfDue(
  campaignId: string,
  scope: CompanyScope
): Promise<boolean> {
  const campaign = await getCampaign(campaignId, scope);
  if (!campaign || campaign.status !== "draft") return false;
  if (!campaign.scheduledAt) return false;
  const ms = campaign.scheduledAt.toMillis?.() ?? 0;
  if (ms > Date.now()) return false;
  await updateCampaignStatus(campaignId, "running", scope);
  await runCampaignBatches(campaignId, scope);
  return true;
}
