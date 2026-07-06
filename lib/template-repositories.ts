import { Prisma } from "@prisma/client";
import { getSql } from "./db";
import { templateFromRow } from "./db-mappers";
import type { CompanyScope } from "./firestore-repositories";
import type { Template, TemplateStatus } from "./types";

/** JSON opcional para escrita no Prisma (undefined = não altera a coluna). */
function j(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null
    ? undefined
    : (value as Prisma.InputJsonValue);
}

export async function listTemplatesForCompany(
  scope: CompanyScope
): Promise<Template[]> {
  const sql = getSql();
  let rows = await sql.template.findMany({
    where: { companyId: scope.companyId },
    orderBy: { updatedAt: "desc" },
  });

  if (rows.length === 0) {
    // Templates legados sem companyId (globais) continuam visíveis.
    rows = await sql.template.findMany({
      where: { OR: [{ companyId: null }, { companyId: scope.companyId }] },
      orderBy: { updatedAt: "desc" },
    });
  }

  return rows.map(templateFromRow);
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
  const row = await getSql().template.findUnique({ where: { id } });
  if (!row) return null;
  const template = templateFromRow(row);
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
  const row = await getSql().template.create({
    data: {
      name: data.name,
      language: data.language,
      category: data.category,
      body: data.body,
      header: j(data.header),
      variableSamples: j(data.variableSamples),
      footer: data.footer,
      buttons: j(data.buttons),
      status: "draft",
      companyId: scope.companyId,
      requiresMetaApproval: data.requiresMetaApproval ?? true,
    },
  });
  return templateFromRow(row);
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

  await getSql().template.update({
    where: { id },
    data: {
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.header !== undefined
        ? { header: data.header as unknown as Prisma.InputJsonValue }
        : {}),
      ...(data.variableSamples !== undefined
        ? { variableSamples: data.variableSamples as Prisma.InputJsonValue }
        : {}),
      ...(data.footer !== undefined ? { footer: data.footer } : {}),
      ...(data.buttons !== undefined
        ? { buttons: data.buttons as unknown as Prisma.InputJsonValue }
        : {}),
      ...(data.requiresMetaApproval !== undefined
        ? { requiresMetaApproval: data.requiresMetaApproval }
        : {}),
    },
  });
  const updated = await getTemplate(id, scope);
  return updated!;
}

export async function updateTemplateStatus(
  id: string,
  status: TemplateStatus,
  extra: Partial<Template> = {}
): Promise<void> {
  await getSql().template.update({
    where: { id },
    data: {
      status,
      ...(extra.metaTemplateId !== undefined
        ? { metaTemplateId: extra.metaTemplateId }
        : {}),
      ...(extra.submittedAt !== undefined
        ? { submittedAt: new Date(extra.submittedAt) }
        : {}),
      ...(extra.approvedAt !== undefined
        ? { approvedAt: new Date(extra.approvedAt) }
        : {}),
      ...(extra.rejectionReason !== undefined
        ? { rejectionReason: extra.rejectionReason }
        : {}),
    },
  });
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
  const sql = getSql();
  let synced = 0;

  const existingRows = await sql.template.findMany({
    where: { companyId: scope.companyId },
    select: { id: true, name: true, language: true },
  });
  const existingByKey = new Map(
    existingRows.map((row) => [`${row.name}::${row.language || "pt_BR"}`, row])
  );

  for (const pt of providerTemplates) {
    const key = `${pt.name}::${pt.language || "pt_BR"}`;
    const existing = existingByKey.get(key);
    const now = new Date();

    if (existing) {
      await sql.template.update({
        where: { id: existing.id },
        data: {
          status: pt.status,
          body: pt.body,
          metaTemplateId: pt.id,
          ...(pt.status === "approved" ? { approvedAt: now } : {}),
        },
      });
    } else {
      await sql.template.create({
        data: {
          name: pt.name,
          language: pt.language,
          category: pt.category,
          status: pt.status,
          body: pt.body,
          metaTemplateId: pt.id,
          companyId: scope.companyId,
          requiresMetaApproval: true,
          ...(pt.status === "approved" ? { approvedAt: now } : {}),
        },
      });
    }
    synced++;
  }
  return synced;
}
