import { getSql } from "./db";
import { dealFromRow, pipelineStageFromRow } from "./db-mappers";
import type { CompanyScope } from "./firestore-repositories";
import type { Deal, PipelineStage } from "./types";

const DEFAULT_STAGES = [
  { name: "Novo", order: 0, color: "#6366f1" },
  { name: "Contato", order: 1, color: "#8b5cf6" },
  { name: "Agendado", order: 2, color: "#0ea5e9" },
  { name: "Ganho", order: 3, color: "#10b981" },
  { name: "Perdido", order: 4, color: "#ef4444" },
];

export async function ensureDefaultPipeline(
  scope: CompanyScope
): Promise<void> {
  const sql = getSql();
  const existing = await sql.pipelineStage.findFirst({
    where: { companyId: scope.companyId },
    select: { id: true },
  });
  if (existing) return;

  await sql.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((stage) => ({
      ...stage,
      companyId: scope.companyId,
    })),
  });
}

export async function listPipelineStages(
  scope: CompanyScope
): Promise<PipelineStage[]> {
  await ensureDefaultPipeline(scope);
  const rows = await getSql().pipelineStage.findMany({
    where: { companyId: scope.companyId },
    orderBy: { order: "asc" },
  });
  return rows.map(pipelineStageFromRow);
}

export async function listDeals(scope: CompanyScope): Promise<Deal[]> {
  const rows = await getSql().deal.findMany({
    where: { companyId: scope.companyId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(dealFromRow);
}

export async function createDeal(
  data: Pick<Deal, "title" | "contactId" | "stageId" | "value" | "source" | "assignedTo">,
  scope: CompanyScope
): Promise<Deal> {
  const sql = getSql();
  const row = await sql.deal.create({
    data: {
      title: data.title,
      contactId: data.contactId,
      stageId: data.stageId,
      value: data.value,
      source: data.source,
      assignedTo: data.assignedTo,
      companyId: scope.companyId,
    },
  });

  await sql.funnelEvent.create({
    data: {
      dealId: row.id,
      toStageId: data.stageId,
      companyId: scope.companyId,
    },
  });

  return dealFromRow(row);
}

export async function moveDealToStage(
  dealId: string,
  toStageId: string,
  scope: CompanyScope
): Promise<Deal | null> {
  const sql = getSql();
  const existing = await sql.deal.findFirst({
    where: { id: dealId, companyId: scope.companyId },
  });
  if (!existing) return null;

  const row = await sql.deal.update({
    where: { id: dealId },
    data: { stageId: toStageId },
  });

  await sql.funnelEvent.create({
    data: {
      dealId,
      fromStageId: existing.stageId,
      toStageId,
      companyId: scope.companyId,
    },
  });

  return dealFromRow(row);
}

export async function getDealByContactId(
  contactId: string,
  scope: CompanyScope
): Promise<Deal | null> {
  const row = await getSql().deal.findFirst({
    where: { companyId: scope.companyId, contactId },
  });
  return row ? dealFromRow(row) : null;
}
