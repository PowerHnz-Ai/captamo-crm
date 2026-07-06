import { getSql } from "./db";
import { quickReplyFromRow } from "./db-mappers";
import type { QuickReply, QuickReplyScope } from "./types";

export interface CompanyScope {
  companyId: string;
}

export async function listQuickReplies(
  scope: CompanyScope,
  userId?: string
): Promise<QuickReply[]> {
  const sql = getSql();
  const companyRows = await sql.quickReply.findMany({
    where: { companyId: scope.companyId, scope: "company" },
    orderBy: { sortOrder: "asc" },
  });
  const companyItems = companyRows.map(quickReplyFromRow);

  if (!userId) return companyItems;

  const personalRows = await sql.quickReply.findMany({
    where: { companyId: scope.companyId, scope: "personal", createdBy: userId },
    orderBy: { sortOrder: "asc" },
  });

  return [...companyItems, ...personalRows.map(quickReplyFromRow)];
}

export async function createQuickReply(
  data: {
    title: string;
    body: string;
    scope: QuickReplyScope;
    sortOrder?: number;
  },
  scope: CompanyScope,
  userId: string
): Promise<QuickReply> {
  const row = await getSql().quickReply.create({
    data: {
      companyId: scope.companyId,
      title: data.title,
      body: data.body,
      scope: data.scope,
      createdBy: data.scope === "personal" ? userId : undefined,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  return quickReplyFromRow(row);
}

export async function getQuickReplyById(
  id: string,
  scope: CompanyScope
): Promise<QuickReply | null> {
  const row = await getSql().quickReply.findFirst({
    where: { id, companyId: scope.companyId },
  });
  return row ? quickReplyFromRow(row) : null;
}

export async function updateQuickReply(
  id: string,
  data: Partial<Pick<QuickReply, "title" | "body" | "scope" | "sortOrder">>,
  scope: CompanyScope
): Promise<QuickReply | null> {
  const existing = await getQuickReplyById(id, scope);
  if (!existing) return null;

  const row = await getSql().quickReply.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.scope !== undefined ? { scope: data.scope } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });
  return quickReplyFromRow(row);
}

export async function deleteQuickReply(
  id: string,
  scope: CompanyScope
): Promise<boolean> {
  const result = await getSql().quickReply.deleteMany({
    where: { id, companyId: scope.companyId },
  });
  return result.count > 0;
}

export function canManageCompanyQuickReplies(role: string): boolean {
  return role === "admin" || role === "gerente" || role === "leader";
}

export function canEditQuickReply(
  item: QuickReply,
  userId: string,
  role: string
): boolean {
  if (item.scope === "personal") return item.createdBy === userId;
  return canManageCompanyQuickReplies(role);
}
