import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { CompanyScope } from "./firestore-repositories";
import type { Deal, FunnelEvent, PipelineStage } from "./types";

function nowTimestamp() {
  return Timestamp.now();
}

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
  const snap = await getDb()
    .collection("pipeline_stages")
    .where("companyId", "==", scope.companyId)
    .limit(1)
    .get();

  if (!snap.empty) return;

  const batch = getDb().batch();
  for (const stage of DEFAULT_STAGES) {
    const ref = getDb().collection("pipeline_stages").doc();
    const ts = nowTimestamp();
    batch.set(ref, {
      id: ref.id,
      ...stage,
      companyId: scope.companyId,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  await batch.commit();
}

export async function listPipelineStages(
  scope: CompanyScope
): Promise<PipelineStage[]> {
  await ensureDefaultPipeline(scope);
  const snap = await getDb()
    .collection("pipeline_stages")
    .where("companyId", "==", scope.companyId)
    .orderBy("order", "asc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PipelineStage);
}

export async function listDeals(scope: CompanyScope): Promise<Deal[]> {
  const snap = await getDb()
    .collection("deals")
    .where("companyId", "==", scope.companyId)
    .orderBy("updatedAt", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Deal);
}

export async function createDeal(
  data: Pick<Deal, "title" | "contactId" | "stageId" | "value" | "source" | "assignedTo">,
  scope: CompanyScope
): Promise<Deal> {
  const ts = nowTimestamp();
  const ref = getDb().collection("deals").doc();
  const deal: Omit<Deal, "id"> = {
    ...data,
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...deal });

  await getDb().collection("funnel_events").doc().set({
    id: ref.id + "_create",
    dealId: ref.id,
    toStageId: data.stageId,
    companyId: scope.companyId,
    createdAt: ts,
  } satisfies Omit<FunnelEvent, "id"> & { id: string });

  return { id: ref.id, ...deal };
}

export async function moveDealToStage(
  dealId: string,
  toStageId: string,
  scope: CompanyScope
): Promise<Deal | null> {
  const doc = await getDb().collection("deals").doc(dealId).get();
  if (!doc.exists) return null;
  const deal = { id: doc.id, ...doc.data() } as Deal;
  if (deal.companyId !== scope.companyId) return null;

  const ts = nowTimestamp();
  await doc.ref.update({ stageId: toStageId, updatedAt: ts });

  await getDb().collection("funnel_events").doc().set({
    id: `${dealId}_${Date.now()}`,
    dealId,
    fromStageId: deal.stageId,
    toStageId,
    companyId: scope.companyId,
    createdAt: ts,
  });

  return { ...deal, stageId: toStageId, updatedAt: ts };
}

export async function getDealByContactId(
  contactId: string,
  scope: CompanyScope
): Promise<Deal | null> {
  const snap = await getDb()
    .collection("deals")
    .where("companyId", "==", scope.companyId)
    .where("contactId", "==", contactId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as Deal;
}
