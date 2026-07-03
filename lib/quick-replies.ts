import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { QuickReply, QuickReplyScope } from "./types";

export interface CompanyScope {
  companyId: string;
}

function nowTimestamp() {
  return Timestamp.now();
}

export async function listQuickReplies(
  scope: CompanyScope,
  userId?: string
): Promise<QuickReply[]> {
  const companySnap = await getDb()
    .collection("quick_replies")
    .where("companyId", "==", scope.companyId)
    .where("scope", "==", "company")
    .orderBy("sortOrder", "asc")
    .get();

  const companyItems = companySnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as QuickReply
  );

  if (!userId) return companyItems;

  const personalSnap = await getDb()
    .collection("quick_replies")
    .where("companyId", "==", scope.companyId)
    .where("scope", "==", "personal")
    .where("createdBy", "==", userId)
    .orderBy("sortOrder", "asc")
    .get();

  const personalItems = personalSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as QuickReply
  );

  return [...companyItems, ...personalItems];
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
  const ts = nowTimestamp();
  const ref = getDb().collection("quick_replies").doc();
  const item: Omit<QuickReply, "id"> = {
    companyId: scope.companyId,
    title: data.title,
    body: data.body,
    scope: data.scope,
    createdBy: data.scope === "personal" ? userId : undefined,
    sortOrder: data.sortOrder ?? 0,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...item });
  return { id: ref.id, ...item };
}

export async function getQuickReplyById(
  id: string,
  scope: CompanyScope
): Promise<QuickReply | null> {
  const doc = await getDb().collection("quick_replies").doc(id).get();
  if (!doc.exists) return null;
  const item = { id: doc.id, ...doc.data() } as QuickReply;
  if (item.companyId !== scope.companyId) return null;
  return item;
}

export async function updateQuickReply(
  id: string,
  data: Partial<Pick<QuickReply, "title" | "body" | "scope" | "sortOrder">>,
  scope: CompanyScope
): Promise<QuickReply | null> {
  const existing = await getQuickReplyById(id, scope);
  if (!existing) return null;

  const updated = {
    ...data,
    updatedAt: nowTimestamp(),
  };
  await getDb().collection("quick_replies").doc(id).update(updated);
  return { ...existing, ...updated };
}

export async function deleteQuickReply(
  id: string,
  scope: CompanyScope
): Promise<boolean> {
  const existing = await getQuickReplyById(id, scope);
  if (!existing) return false;
  await getDb().collection("quick_replies").doc(id).delete();
  return true;
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
