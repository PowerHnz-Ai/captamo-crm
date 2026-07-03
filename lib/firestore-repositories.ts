import { FieldValue, FieldPath, Timestamp } from "firebase-admin/firestore";
import type {
  CollectionReference,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type {
  Contact,
  ContactList,
  Conversation,
  ConversationListItem,
  DashboardStats,
  Message,
  MessageReaction,
  Template,
} from "./types";
import { isWithinConversationWindow } from "./conversation-window";
import { normalizePhone, phonesMatch } from "./whatsapp/phone";

export interface CompanyScope {
  companyId: string;
}

const OPT_OUT_KEYWORDS = ["SAIR", "PARAR", "REMOVER", "CANCELAR"];

export function isOptOutMessage(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return OPT_OUT_KEYWORDS.includes(normalized);
}

function nowTimestamp() {
  return Timestamp.now();
}

export async function ensureDefaultTemplate(): Promise<void> {
  const ref = getDb().collection("templates").doc("confirmacao_agendamento");
  const snap = await ref.get();
  if (snap.exists) return;

  const ts = nowTimestamp();
  await ref.set({
    id: "confirmacao_agendamento",
    name: "confirmacao_agendamento",
    language: "pt_BR",
    category: "utility",
    status: "approved",
    body: "Olá, {{1}}! Sua consulta na Mister Odonto está confirmada para {{2}} às {{3}}. Qualquer dúvida, responda esta mensagem.",
    createdAt: ts,
    updatedAt: ts,
  } satisfies Omit<Template, "id"> & { id: string });
}

export async function findContactByPhone(
  phone: string,
  scope: CompanyScope
): Promise<Contact | null> {
  let target: string;
  try {
    target = normalizePhone(phone);
  } catch {
    target = phone.replace(/[\s+\-()]/g, "");
  }

  const snap = await getDb()
    .collection("contacts")
    .where("companyId", "==", scope.companyId)
    .get();

  const match = snap.docs.find((doc) => {
    const stored = (doc.data() as Contact).phone;
    return phonesMatch(stored, target);
  });
  if (!match) return null;
  return { id: match.id, ...match.data() } as Contact;
}

export async function createOrGetContactByPhone(
  phone: string,
  scope: CompanyScope,
  data?: Partial<Pick<Contact, "name" | "source" | "tags" | "optIn">>
): Promise<Contact> {
  const existing = await findContactByPhone(phone, scope);
  if (existing) {
    let normalizedPhone: string | undefined;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      normalizedPhone = undefined;
    }

    const updates: Partial<Pick<Contact, "name" | "source">> = {};
    if (data?.name && data.name !== existing.name) {
      updates.name = data.name;
      updates.source = data.source;
    }
    if (normalizedPhone && normalizedPhone !== existing.phone) {
      await getDb().collection("contacts").doc(existing.id).update({
        phone: normalizedPhone,
        ...updates,
        updatedAt: nowTimestamp(),
      });
      return {
        ...existing,
        phone: normalizedPhone,
        ...updates,
      };
    }
    if (updates.name) {
      await updateContact(existing.id, updates);
      return { ...existing, ...updates };
    }
    return existing;
  }

  let storedPhone = phone;
  try {
    storedPhone = normalizePhone(phone);
  } catch {
    storedPhone = phone.replace(/[\s+\-()]/g, "");
  }

  const ts = nowTimestamp();
  const ref = getDb().collection("contacts").doc();
  const contact: Omit<Contact, "id"> = {
    name: data?.name || storedPhone,
    phone: storedPhone,
    source: data?.source || "whatsapp",
    tags: data?.tags || [],
    optIn: data?.optIn ?? true,
    blocked: false,
    archived: false,
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };

  await ref.set({ id: ref.id, ...contact });
  return { id: ref.id, ...contact };
}

export async function updateContact(
  id: string,
  data: Partial<
    Pick<
      Contact,
      | "name"
      | "phone"
      | "source"
      | "tags"
      | "optIn"
      | "blocked"
      | "archived"
      | "notes"
      | "customFields"
      | "originId"
      | "originFields"
      | "leadClass"
    >
  >
): Promise<void> {
  await getDb()
    .collection("contacts")
    .doc(id)
    .update({ ...data, updatedAt: nowTimestamp() });
}

export async function deleteContact(
  id: string,
  scope: CompanyScope
): Promise<boolean> {
  const contact = await getContactById(id, scope);
  if (!contact) return false;
  await getDb().collection("contacts").doc(id).delete();
  return true;
}

export async function getContactById(
  id: string,
  scope: CompanyScope
): Promise<Contact | null> {
  const doc = await getDb().collection("contacts").doc(id).get();
  if (!doc.exists) return null;
  const contact = { id: doc.id, ...doc.data() } as Contact;
  if (contact.companyId !== scope.companyId) return null;
  return contact;
}

export async function blockContactByPhone(
  phone: string,
  scope: CompanyScope
): Promise<void> {
  const contact = await findContactByPhone(phone, scope);
  if (!contact) return;
  await updateContact(contact.id, { blocked: true, optIn: false });
}

export async function isContactBlocked(
  phone: string,
  scope: CompanyScope
): Promise<boolean> {
  const contact = await findContactByPhone(phone, scope);
  return contact?.blocked === true;
}

export async function listContacts(
  scope: CompanyScope,
  filters?: { tag?: string; search?: string; archived?: boolean; originId?: string }
): Promise<Contact[]> {
  const snap = await getDb()
    .collection("contacts")
    .where("companyId", "==", scope.companyId)
    .get();

  let contacts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Contact);

  if (filters?.archived !== undefined) {
    contacts = contacts.filter((c) => Boolean(c.archived) === filters.archived);
  }

  contacts.sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  if (filters?.tag) {
    contacts = contacts.filter((c) => c.tags?.includes(filters.tag!));
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    contacts = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }

  if (filters?.originId) {
    contacts = contacts.filter((c) => c.originId === filters.originId);
  }

  return contacts;
}

export async function importContacts(
  rows: Array<
    Pick<
      Contact,
      "name" | "phone" | "source" | "tags" | "optIn" | "customFields" | "originId" | "originFields" | "leadClass"
    >
  >,
  scope: CompanyScope,
  options?: { duplicatePolicy?: "tag_existing" | "skip" | "update" }
): Promise<{ created: number; skipped: number; updated: number }> {
  const policy = options?.duplicatePolicy || "skip";
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await findContactByPhone(row.phone, scope);
    if (existing) {
      if (policy === "skip") {
        skipped++;
        continue;
      }

      const mergedTags = [...new Set([...(existing.tags || []), ...(row.tags || [])])];
      const patch: Partial<
        Pick<Contact, "name" | "tags" | "customFields" | "originId" | "originFields" | "leadClass">
      > = {
        tags: mergedTags,
      };

      if (policy === "update") {
        if (row.name) patch.name = row.name;
        if (row.customFields) {
          patch.customFields = { ...(existing.customFields || {}), ...row.customFields };
        }
        if (row.originId) patch.originId = row.originId;
        if (row.originFields) {
          patch.originFields = { ...(existing.originFields || {}), ...row.originFields };
        }
      } else if (policy === "tag_existing") {
        if (row.customFields) {
          patch.customFields = { ...(existing.customFields || {}), ...row.customFields };
        }
        if (row.originId) patch.originId = row.originId;
        if (row.originFields) {
          patch.originFields = { ...(existing.originFields || {}), ...row.originFields };
        }
      }

      await updateContact(existing.id, patch);
      updated++;
      continue;
    }

    await createContactManual(row, scope);
    created++;
  }

  return { created, skipped, updated };
}

export async function createContactManual(
  data: Pick<
    Contact,
    "name" | "phone" | "source" | "tags" | "optIn" | "notes" | "customFields" | "originId" | "originFields" | "leadClass"
  >,
  scope: CompanyScope
): Promise<Contact> {
  const normalizedPhone = normalizePhone(data.phone);
  const existing = await findContactByPhone(normalizedPhone, scope);
  if (existing) {
    throw new Error("Já existe um contato com este telefone.");
  }

  const ts = nowTimestamp();
  const ref = getDb().collection("contacts").doc();
  const contact: Omit<Contact, "id"> = {
    ...data,
    phone: normalizedPhone,
    blocked: false,
    archived: false,
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...contact });
  return { id: ref.id, ...contact };
}

export async function findConversationByPhone(
  phone: string,
  scope: CompanyScope
): Promise<Conversation | null> {
  const snap = await getDb()
    .collection("conversations")
    .where("companyId", "==", scope.companyId)
    .get();

  const matches = snap.docs.filter((doc) => {
    const stored = (doc.data() as Conversation).phone;
    return phonesMatch(stored, phone);
  });

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aMs = (a.data() as Conversation).lastMessageAt?.toMillis?.() ?? 0;
    const bMs = (b.data() as Conversation).lastMessageAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  const match = matches[0];
  return { id: match.id, ...match.data() } as Conversation;
}

export async function createOrGetConversationByPhone(
  phone: string,
  contactId: string,
  scope: CompanyScope
): Promise<Conversation> {
  const existing = await findConversationByPhone(phone, scope);
  if (existing) {
    let storedPhone: string;
    try {
      storedPhone = normalizePhone(phone);
    } catch {
      storedPhone = phone.replace(/[\s+\-()]/g, "");
    }

    if (storedPhone !== existing.phone || existing.contactId !== contactId) {
      await getDb().collection("conversations").doc(existing.id).update({
        phone: storedPhone,
        contactId,
        updatedAt: nowTimestamp(),
      });
      return { ...existing, phone: storedPhone, contactId };
    }
    return existing;
  }

  let storedPhone = phone;
  try {
    storedPhone = normalizePhone(phone);
  } catch {
    storedPhone = phone.replace(/[\s+\-()]/g, "");
  }

  const ts = nowTimestamp();
  const ref = getDb().collection("conversations").doc();
  const conversation: Omit<Conversation, "id"> = {
    contactId,
    phone: storedPhone,
    status: "open",
    lastMessageAt: ts,
    unreadCount: 0,
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };

  await ref.set({ id: ref.id, ...conversation });
  return { id: ref.id, ...conversation };
}

export async function getConversationById(
  id: string,
  scope: CompanyScope
): Promise<Conversation | null> {
  const doc = await getDb().collection("conversations").doc(id).get();
  if (!doc.exists) return null;
  const conversation = { id: doc.id, ...doc.data() } as Conversation;
  if (conversation.companyId !== scope.companyId) return null;
  return conversation;
}

function sanitizeWhatsAppMessageRefId(id?: string): string | null {
  if (!id || typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/")) return null;
  if (trimmed === "." || trimmed === "..") return null;
  if (trimmed.length > 1500) return null;
  if (/^__.*__$/.test(trimmed)) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;
  return trimmed;
}

async function collectConversationWhatsAppRefIds(
  messagesRef: CollectionReference
): Promise<Set<string>> {
  const refIds = new Set<string>();
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let query = messagesRef.orderBy(FieldPath.documentId()).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const refId = sanitizeWhatsAppMessageRefId(
        (doc.data() as Message).whatsappMessageId
      );
      if (refId) refIds.add(refId);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }

  return refIds;
}

async function deleteWhatsAppMessageRefs(refIds: Iterable<string>): Promise<void> {
  const db = getDb();
  const bulkWriter = db.bulkWriter();
  bulkWriter.onWriteError((error) => {
    if (error.code === 5) return false;
    return error.failedAttempts < 3;
  });

  for (const refId of refIds) {
    try {
      bulkWriter.delete(db.collection("whatsapp_message_refs").doc(refId));
    } catch (error) {
      console.warn(
        "[deleteConversation] Ref WhatsApp ignorada:",
        refId.slice(0, 40),
        error
      );
    }
  }

  await bulkWriter.close();
}

export async function deleteConversation(
  id: string,
  scope: CompanyScope
): Promise<boolean> {
  const conversation = await getConversationById(id, scope);
  if (!conversation) return false;

  const db = getDb();
  const messagesRef = db
    .collection("conversations")
    .doc(id)
    .collection("messages");

  const refIds = await collectConversationWhatsAppRefIds(messagesRef);

  await db.recursiveDelete(messagesRef);
  await deleteWhatsAppMessageRefs(refIds);
  await db.collection("conversations").doc(id).delete();

  return true;
}

export async function updateConversationLastMessage(
  conversationId: string,
  preview: string,
  inbound = false
): Promise<void> {
  const update: Record<string, unknown> = {
    lastMessageAt: nowTimestamp(),
    lastMessagePreview: preview,
    updatedAt: nowTimestamp(),
  };

  if (inbound) {
    update.lastInboundAt = nowTimestamp();
    update.unreadCount = FieldValue.increment(1);
  }

  if (inbound) {
    const doc = await getDb().collection("conversations").doc(conversationId).get();
    if (doc.exists && doc.data()?.status === "closed") {
      update.status = "open";
    }
  }

  await getDb().collection("conversations").doc(conversationId).update(update);
}

export async function updateConversationStatus(
  conversationId: string,
  status: Conversation["status"],
  options?: { markRead?: boolean }
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updatedAt: nowTimestamp(),
  };
  if (options?.markRead && status === "closed") {
    update.unreadCount = 0;
  }
  await getDb().collection("conversations").doc(conversationId).update(update);
}

export async function updateConversationAssignment(
  conversationId: string,
  assignedTo: string | null,
  scope: CompanyScope
): Promise<void> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) throw new Error("Conversa não encontrada.");

  const ts = nowTimestamp();
  if (assignedTo) {
    await getDb().collection("conversations").doc(conversationId).update({
      assignedTo,
      assignedAt: ts,
      updatedAt: ts,
    });
  } else {
    await getDb().collection("conversations").doc(conversationId).update({
      assignedTo: FieldValue.delete(),
      assignedAt: FieldValue.delete(),
      updatedAt: ts,
    });
  }
}

export async function listContactLists(
  scope: CompanyScope
): Promise<ContactList[]> {
  const snap = await getDb()
    .collection("contact_lists")
    .where("companyId", "==", scope.companyId)
    .get();

  const lists = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ContactList);
  lists.sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
  return lists;
}

export async function createContactList(
  data: Pick<ContactList, "name" | "description" | "tagFilter" | "contactIds">,
  scope: CompanyScope
): Promise<ContactList> {
  const ts = nowTimestamp();
  const ref = getDb().collection("contact_lists").doc();
  const list: Omit<ContactList, "id"> = {
    ...data,
    contactIds: data.contactIds || [],
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...list });
  return { id: ref.id, ...list };
}

export async function updateContactList(
  listId: string,
  data: Partial<Pick<ContactList, "name" | "description" | "tagFilter" | "contactIds">>,
  scope: CompanyScope
): Promise<ContactList | null> {
  const doc = await getDb().collection("contact_lists").doc(listId).get();
  if (!doc.exists) return null;
  const existing = doc.data() as ContactList;
  if (existing.companyId !== scope.companyId) return null;

  const patch = {
    ...data,
    updatedAt: nowTimestamp(),
  };
  await doc.ref.update(patch);
  return { ...existing, ...patch, id: listId };
}

export async function deleteContactList(
  listId: string,
  scope: CompanyScope
): Promise<boolean> {
  const doc = await getDb().collection("contact_lists").doc(listId).get();
  if (!doc.exists) return false;
  const existing = doc.data() as ContactList;
  if (existing.companyId !== scope.companyId) return false;
  await doc.ref.delete();
  return true;
}

export async function getContactsForList(
  listId: string,
  scope: CompanyScope
): Promise<Contact[]> {
  const doc = await getDb().collection("contact_lists").doc(listId).get();
  if (!doc.exists) return [];
  const list = doc.data() as ContactList;
  if (list.companyId !== scope.companyId) return [];

  if (list.contactIds?.length) {
    const contacts: Contact[] = [];
    for (const id of list.contactIds) {
      const c = await getContactById(id, scope);
      if (c && !c.blocked && c.optIn) contacts.push(c);
    }
    return contacts;
  }

  if (list.tagFilter?.length) {
    const all = await listContacts(scope);
    return all.filter(
      (c) =>
        !c.blocked &&
        c.optIn &&
        list.tagFilter!.some((tag) => c.tags?.includes(tag))
    );
  }

  return listContacts(scope).then((all) =>
    all.filter((c) => !c.blocked && c.optIn)
  );
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await getDb().collection("conversations").doc(conversationId).update({
    unreadCount: 0,
    updatedAt: nowTimestamp(),
  });
}

export async function markConversationUnread(conversationId: string): Promise<void> {
  await getDb().collection("conversations").doc(conversationId).update({
    unreadCount: 1,
    updatedAt: nowTimestamp(),
  });
}

export async function updateConversationConnection(
  conversationId: string,
  connectionId: string
): Promise<void> {
  await getDb().collection("conversations").doc(conversationId).update({
    connectionId,
    updatedAt: nowTimestamp(),
  });
}

/** Garante connectionId na conversa (usa conexão default se ausente). */
export async function ensureConversationConnection(
  conversation: Conversation,
  scope: CompanyScope
): Promise<Conversation> {
  if (conversation.connectionId) return conversation;
  const { getDefaultConnection } = await import("./connections");
  const defaultConn = await getDefaultConnection(scope.companyId);
  if (!defaultConn) return conversation;
  await updateConversationConnection(conversation.id, defaultConn.id);
  return { ...conversation, connectionId: defaultConn.id };
}

export async function isConversationWindowOpen(
  conversationId: string,
  scope: CompanyScope
): Promise<boolean> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return false;
  return isWithinConversationWindow(conversation.lastInboundAt);
}

export async function saveInboundMessage(
  data: Omit<Message, "id" | "createdAt" | "direction" | "status"> & {
    status?: Message["status"];
  }
): Promise<Message> {
  const ts = nowTimestamp();
  const ref = getDb()
    .collection("conversations")
    .doc(data.conversationId)
    .collection("messages")
    .doc();

  const message: Omit<Message, "id"> = {
    ...data,
    direction: "inbound",
    status: data.status || "received",
    createdAt: ts,
  };

  await ref.set({ id: ref.id, ...message });
  await updateConversationLastMessage(data.conversationId, data.body, true);

  if (data.whatsappMessageId) {
    const conversation = await getDb()
      .collection("conversations")
      .doc(data.conversationId)
      .get();
    const companyId = conversation.data()?.companyId as string | undefined;
    if (companyId) {
      const { saveWhatsAppMessageRef } = await import("./whatsapp-message-refs");
      await saveWhatsAppMessageRef({
        whatsappMessageId: data.whatsappMessageId,
        companyId,
        conversationId: data.conversationId,
        messageId: ref.id,
      });
    }
  }

  return { id: ref.id, ...message };
}

export async function saveOutboundMessage(
  data: Omit<Message, "id" | "createdAt" | "direction"> & {
    direction?: Message["direction"];
  }
): Promise<Message> {
  const ts = nowTimestamp();
  const ref = getDb()
    .collection("conversations")
    .doc(data.conversationId)
    .collection("messages")
    .doc();

  const message: Omit<Message, "id"> = {
    ...data,
    direction: data.direction || "outbound",
    createdAt: ts,
  };

  await ref.set({ id: ref.id, ...message });
  await updateConversationLastMessage(data.conversationId, data.body, false);

  const convDoc = await getDb().collection("conversations").doc(data.conversationId).get();
  const convData = convDoc.data() as Conversation | undefined;
  if (convData && !convData.firstResponseAt) {
    await convDoc.ref.update({
      firstResponseAt: ts,
      updatedAt: ts,
    });
  }

  if (data.whatsappMessageId) {
    const conversation = await getDb()
      .collection("conversations")
      .doc(data.conversationId)
      .get();
    const companyId = conversation.data()?.companyId as string | undefined;
    if (companyId) {
      const { saveWhatsAppMessageRef } = await import("./whatsapp-message-refs");
      await saveWhatsAppMessageRef({
        whatsappMessageId: data.whatsappMessageId,
        companyId,
        conversationId: data.conversationId,
        messageId: ref.id,
      });
    }
  }

  return { id: ref.id, ...message };
}

export async function updateMessageStatusByWhatsAppId(
  whatsappMessageId: string,
  status: Message["status"],
  statusError?: string
): Promise<void> {
  const { resolveWhatsAppMessageRef } = await import("./whatsapp-message-refs");

  const known = await resolveWhatsAppMessageRef(whatsappMessageId);
  if (!known) {
    console.warn("[webhook] Status update: ref não encontrada", whatsappMessageId);
    return;
  }

  const update: Record<string, unknown> = { status };
  if (statusError) {
    update.statusError = statusError;
  } else if (status !== "failed") {
    update.statusError = null;
  }

  await getDb()
    .collection("conversations")
    .doc(known.conversationId)
    .collection("messages")
    .doc(known.messageId)
    .update(update);
}

export async function updateMessageAfterResend(
  conversationId: string,
  messageId: string,
  data: {
    whatsappMessageId?: string;
    status: Message["status"];
    rawPayload?: unknown;
  }
): Promise<void> {
  const update: Record<string, unknown> = {
    status: data.status,
    updatedAt: nowTimestamp(),
  };
  if (data.whatsappMessageId) {
    update.whatsappMessageId = data.whatsappMessageId;
  }
  if (data.rawPayload !== undefined) {
    update.rawPayload = data.rawPayload;
  }
  await getDb()
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId)
    .update(update);
}

export async function listConversations(
  scope: CompanyScope,
  filters?: {
    status?: Conversation["status"];
    unreadOnly?: boolean;
    tag?: string;
    assignedTo?: string;
    /** "__unassigned__" filtra conversas sem responsável. */
    window?: "open" | "closed";
    /** Caixa de entrada ativa (conexão WhatsApp). */
    connectionId?: string;
    period?: "today" | "yesterday" | "7d" | "30d";
    search?: string;
    noResponseOnly?: boolean;
  }
): Promise<ConversationListItem[]> {
  let query = getDb()
    .collection("conversations")
    .where("companyId", "==", scope.companyId) as FirebaseFirestore.Query;

  if (filters?.status) {
    query = query.where("status", "==", filters.status);
  }

  const snap = await query.orderBy("lastMessageAt", "desc").get();

  let conversations = snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Conversation
  );

  // Uma thread por telefone — evita duplicatas na lista e cliques em conversa vazia.
  const byPhone = new Map<string, Conversation>();
  for (const c of conversations) {
    let key = c.phone;
    try {
      key = normalizePhone(c.phone);
    } catch {
      key = c.phone.replace(/\D/g, "");
    }
    const existing = byPhone.get(key);
    if (!existing) {
      byPhone.set(key, c);
      continue;
    }
    const existingMs = existing.lastMessageAt?.toMillis?.() ?? 0;
    const currentMs = c.lastMessageAt?.toMillis?.() ?? 0;
    if (currentMs >= existingMs) byPhone.set(key, c);
  }
  conversations = [...byPhone.values()].sort((a, b) => {
    const aMs = a.lastMessageAt?.toMillis?.() ?? 0;
    const bMs = b.lastMessageAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  if (filters?.assignedTo === "__unassigned__") {
    conversations = conversations.filter((c) => !c.assignedTo);
  } else if (filters?.assignedTo) {
    conversations = conversations.filter((c) => c.assignedTo === filters.assignedTo);
  }

  if (filters?.unreadOnly) {
    conversations = conversations.filter((c) => (c.unreadCount || 0) > 0);
  }

  if (filters?.connectionId || filters?.window) {
    const { listConnections } = await import("./connections");
    const connections = await listConnections(scope.companyId);
    const defaultConn = connections.find((c) => c.isDefault) || connections[0];
    const providerByConn = new Map(connections.map((c) => [c.id, c.provider]));
    const resolveInboxId = (c: Conversation) =>
      c.connectionId || defaultConn?.id;

    if (filters?.connectionId) {
      conversations = conversations.filter(
        (c) => resolveInboxId(c) === filters.connectionId
      );
    }

    if (filters?.window) {
      const { isActionableConversationWindow } = await import(
        "./conversation-window"
      );
      conversations = conversations.filter((c) => {
        const connId = resolveInboxId(c);
        const provider = connId
          ? (providerByConn.get(connId) ?? "meta_cloud")
          : "meta_cloud";
        const open = isActionableConversationWindow(c.lastInboundAt, provider);
        return filters.window === "open" ? open : !open;
      });
    }
  }

  if (filters?.period) {
    const { toDate } = await import("./conversation-window");
    const now = new Date();
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());

    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    switch (filters.period) {
      case "today":
        rangeStart = startOfDay(now);
        rangeEnd = now;
        break;
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        rangeStart = startOfDay(y);
        rangeEnd = startOfDay(now);
        break;
      }
      case "7d":
        rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        rangeEnd = now;
        break;
      case "30d":
        rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        rangeEnd = now;
        break;
    }

    if (rangeStart && rangeEnd) {
      const startMs = rangeStart.getTime();
      const endMs = rangeEnd.getTime();
      conversations = conversations.filter((c) => {
        const date = toDate(c.lastMessageAt as Parameters<typeof toDate>[0]);
        if (!date) return false;
        const ms = date.getTime();
        return ms >= startMs && ms <= endMs;
      });
    }
  }

  const contactIds = [...new Set(conversations.map((c) => c.contactId))];
  const contactMap = new Map<string, { name: string; tags: string[] }>();

  await Promise.all(
    contactIds.map(async (id) => {
      const doc = await getDb().collection("contacts").doc(id).get();
      if (doc.exists) {
        const contact = doc.data() as Contact;
        if (contact.companyId === scope.companyId) {
          contactMap.set(id, { name: contact.name, tags: contact.tags || [] });
        }
      }
    })
  );

  if (filters?.tag) {
    conversations = conversations.filter((c) => {
      const contact = contactMap.get(c.contactId);
      return contact?.tags?.includes(filters.tag!);
    });
  }

  if (filters?.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) {
      conversations = conversations.filter((c) => {
        const contact = contactMap.get(c.contactId);
        const name = (contact?.name || "").toLowerCase();
        return name.includes(q) || (c.phone || "").toLowerCase().includes(q);
      });
    }
  }

  if (filters?.noResponseOnly) {
    const { isWithinConversationWindow } = await import("./conversation-window");
    conversations = conversations.filter((c) => {
      if (c.firstResponseAt) return false;
      return isWithinConversationWindow(c.lastInboundAt);
    });
  }

  const { getAttendantNameMap } = await import("./lead-assignment");
  const nameMap = await getAttendantNameMap(scope);

  return conversations.map((c) => {
    const contact = contactMap.get(c.contactId);
    return {
      ...c,
      contactName: contact?.name,
      contactTags: contact?.tags,
      assignedToName: c.assignedTo ? nameMap.get(c.assignedTo) : undefined,
    };
  });
}

export async function listConversationMessages(
  conversationId: string,
  scope: CompanyScope,
  options?: { limit?: number; before?: number }
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return { messages: [], hasMore: false };

  const messagesRef = getDb()
    .collection("conversations")
    .doc(conversationId)
    .collection("messages");

  if (!options?.limit && !options?.before) {
    const snap = await messagesRef.orderBy("createdAt", "asc").get();
    return {
      messages: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Message),
      hasMore: false,
    };
  }

  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  let query = messagesRef.orderBy("createdAt", "desc") as Query;

  if (options.before) {
    query = query.where(
      "createdAt",
      "<",
      Timestamp.fromMillis(options.before)
    );
  }

  const snap = await query.limit(limit + 1).get();
  const docs = snap.docs;
  const hasMore = docs.length > limit;
  const slice = hasMore ? docs.slice(0, limit) : docs;
  const messages = slice
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Message)
    .reverse();

  return { messages, hasMore };
}

export async function getConversationMessage(
  conversationId: string,
  messageId: string,
  scope: CompanyScope
): Promise<Message | null> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return null;

  const doc = await getDb()
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId)
    .get();

  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Message;
}

export async function applyMessageReaction(
  conversationId: string,
  messageId: string,
  reaction: MessageReaction,
  scope: CompanyScope
): Promise<void> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return;

  const docRef = getDb()
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId);

  const doc = await docRef.get();
  if (!doc.exists) return;

  const existing = doc.data() as Message;
  const reactions = [...(existing.reactions || [])];
  const index = reactions.findIndex((item) => item.from === reaction.from);

  if (!reaction.emoji.trim()) {
    if (index >= 0) reactions.splice(index, 1);
  } else if (index >= 0) {
    reactions[index] = reaction;
  } else {
    reactions.push(reaction);
  }

  await docRef.set({ reactions }, { merge: true });
}

export async function updateConversationMessageMedia(
  conversationId: string,
  messageId: string,
  media: Message["media"],
  scope: CompanyScope
): Promise<void> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return;

  await getDb()
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId)
    .set({ media }, { merge: true });
}

export async function markMessageDeleted(
  conversationId: string,
  messageId: string,
  scope: CompanyScope
): Promise<void> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return;

  await getDb()
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId)
    .set(
      { deletedAt: nowTimestamp(), body: "" },
      { merge: true }
    );
}

export async function listTemplates(): Promise<Template[]> {
  await ensureDefaultTemplate();
  const snap = await getDb().collection("templates").orderBy("name").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Template);
}

export async function getDashboardStats(scope: CompanyScope): Promise<DashboardStats> {
  const companyId = scope.companyId;

  const [contactsCount, conversationsCount] = await Promise.all([
    getDb()
      .collection("contacts")
      .where("companyId", "==", companyId)
      .count()
      .get(),
    getDb()
      .collection("conversations")
      .where("companyId", "==", companyId)
      .count()
      .get(),
  ]);

  const conversationsSnap = await getDb()
    .collection("conversations")
    .where("companyId", "==", companyId)
    .select()
    .get();

  const conversationIds = conversationsSnap.docs.map((doc) => doc.id);

  let messagesSent = 0;
  let messagesReceived = 0;
  let messagesFailed = 0;

  await Promise.all(
    conversationIds.map(async (conversationId) => {
      const [sent, received, failed] = await Promise.all([
        getDb()
          .collection("conversations")
          .doc(conversationId)
          .collection("messages")
          .where("direction", "==", "outbound")
          .count()
          .get(),
        getDb()
          .collection("conversations")
          .doc(conversationId)
          .collection("messages")
          .where("direction", "==", "inbound")
          .count()
          .get(),
        getDb()
          .collection("conversations")
          .doc(conversationId)
          .collection("messages")
          .where("status", "==", "failed")
          .count()
          .get(),
      ]);

      messagesSent += sent.data().count;
      messagesReceived += received.data().count;
      messagesFailed += failed.data().count;
    })
  );

  return {
    totalContacts: contactsCount.data().count,
    totalConversations: conversationsCount.data().count,
    messagesSent,
    messagesReceived,
    messagesFailed,
  };
}

export async function saveIntegrationEvent(
  source: string,
  payload: unknown,
  status: "success" | "failed",
  scope: CompanyScope
): Promise<void> {
  const ref = getDb().collection("integration_events").doc();
  await ref.set({
    id: ref.id,
    source,
    payload,
    status,
    companyId: scope.companyId,
    createdAt: nowTimestamp(),
  });
}
