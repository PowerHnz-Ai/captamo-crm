import { getSql } from "./db";
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
      return c.scheduledAt <= Date.now();
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
  const sql = getSql();

  // Auto-start: rascunhos agendados cujo horário venceu passam a "running".
  const dueScheduled = await sql.campaign.findMany({
    where: { status: "draft", scheduledAt: { lte: new Date() } },
    select: { id: true, companyId: true },
  });
  for (const campaign of dueScheduled) {
    try {
      await scheduleCampaignIfDue(campaign.id, { companyId: campaign.companyId });
    } catch (error) {
      console.error(
        "[campaign-processor] auto-start falhou",
        { campaignId: campaign.id, companyId: campaign.companyId },
        error
      );
    }
  }

  const rows = await sql.campaign.findMany({
    where: { status: "running" },
    select: { companyId: true },
    distinct: ["companyId"],
  });

  // Erro em uma empresa não pode abortar o tick das demais.
  for (const row of rows) {
    try {
      await processRunningCampaigns({ companyId: row.companyId });
    } catch (error) {
      console.error(
        "[campaign-processor] empresa falhou no tick",
        { companyId: row.companyId },
        error
      );
    }
  }
}

export async function scheduleCampaignIfDue(
  campaignId: string,
  scope: CompanyScope
): Promise<boolean> {
  const campaign = await getCampaign(campaignId, scope);
  if (!campaign || campaign.status !== "draft") return false;
  if (!campaign.scheduledAt) return false;
  if (campaign.scheduledAt > Date.now()) return false;
  await updateCampaignStatus(campaignId, "running", scope);
  await runCampaignBatches(campaignId, scope);
  return true;
}
