import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { CompanyScope } from "./firestore-repositories";
import type { Template, TemplateStatus } from "./types";

function nowTimestamp() {
  return Timestamp.now();
}

export async function listTemplatesForCompany(
  scope: CompanyScope
): Promise<Template[]> {
  const snap = await getDb()
    .collection("templates")
    .where("companyId", "==", scope.companyId)
    .get();

  let templates = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Template);

  if (templates.length === 0) {
    const legacy = await getDb().collection("templates").get();
    templates = legacy.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Template)
      .filter((t) => !t.companyId || t.companyId === scope.companyId);
  }

  templates.sort((a, b) => {
    const aMs = a.updatedAt?.toMillis?.() ?? 0;
    const bMs = b.updatedAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  return templates;
}

export async function getTemplateByName(
  name: string,
  scope: CompanyScope
): Promise<Template | null> {
  const templates = await listTemplatesForCompany(scope);
  return templates.find((t) => t.name === name) || null;
}

export async function getTemplate(
  id: string,
  scope: CompanyScope
): Promise<Template | null> {
  const doc = await getDb().collection("templates").doc(id).get();
  if (!doc.exists) return null;
  const template = { id: doc.id, ...doc.data() } as Template;
  if (template.companyId && template.companyId !== scope.companyId) return null;
  return template;
}

export async function createTemplateDraft(
  data: Pick<
    Template,
    | "name"
    | "language"
    | "category"
    | "body"
    | "requiresMetaApproval"
    | "header"
    | "variableSamples"
    | "footer"
    | "buttons"
  >,
  scope: CompanyScope
): Promise<Template> {
  const ts = nowTimestamp();
  const ref = getDb().collection("templates").doc();
  const template: Omit<Template, "id"> = {
    ...data,
    status: "draft",
    companyId: scope.companyId,
    requiresMetaApproval: data.requiresMetaApproval ?? true,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...template });
  return { id: ref.id, ...template };
}

export async function updateTemplateDraft(
  id: string,
  data: Partial<
    Pick<
      Template,
      | "language"
      | "category"
      | "body"
      | "header"
      | "variableSamples"
      | "footer"
      | "buttons"
      | "requiresMetaApproval"
    >
  >,
  scope: CompanyScope
): Promise<Template> {
  const existing = await getTemplate(id, scope);
  if (!existing) {
    throw new Error("Template não encontrado.");
  }
  if (existing.status !== "draft") {
    throw new Error("Apenas templates novos podem ser editados.");
  }

  const patch: Record<string, unknown> = { updatedAt: nowTimestamp() };
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      patch[key] = value;
    }
  }

  await getDb().collection("templates").doc(id).update(patch);
  const updated = await getTemplate(id, scope);
  return updated!;
}

export async function updateTemplateStatus(
  id: string,
  status: TemplateStatus,
  extra: Partial<Template> = {}
): Promise<void> {
  await getDb()
    .collection("templates")
    .doc(id)
    .update({ status, ...extra, updatedAt: nowTimestamp() });
}

export async function syncTemplatesFromProvider(
  scope: CompanyScope,
  providerTemplates: Array<{
    id: string;
    name: string;
    language: string;
    category: string;
    status: TemplateStatus;
    body: string;
  }>
): Promise<number> {
  let synced = 0;
  const existingSnap = await getDb()
    .collection("templates")
    .where("companyId", "==", scope.companyId)
    .get();

  const existingByKey = new Map(
    existingSnap.docs.map((doc) => {
      const data = doc.data() as Template;
      return [`${data.name}::${data.language || "pt_BR"}`, doc];
    })
  );

  for (const pt of providerTemplates) {
    const key = `${pt.name}::${pt.language || "pt_BR"}`;
    const existing = existingByKey.get(key);
    const ts = nowTimestamp();

    if (existing) {
      await existing.ref.update({
        status: pt.status,
        body: pt.body,
        metaTemplateId: pt.id,
        approvedAt: pt.status === "approved" ? ts : undefined,
        updatedAt: ts,
      });
    } else {
      const ref = getDb().collection("templates").doc();
      await ref.set({
        id: ref.id,
        name: pt.name,
        language: pt.language,
        category: pt.category,
        status: pt.status,
        body: pt.body,
        metaTemplateId: pt.id,
        companyId: scope.companyId,
        requiresMetaApproval: true,
        approvedAt: pt.status === "approved" ? ts : undefined,
        createdAt: ts,
        updatedAt: ts,
      });
    }
    synced++;
  }
  return synced;
}
