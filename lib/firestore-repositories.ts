import { Prisma } from "@prisma/client";
import { getSql } from "./db";
import {
  contactFromRow,
  contactListFromRow,
  conversationFromRow,
  messageFromRow,
  templateFromRow,
  safeNormalizePhone,
} from "./db-mappers";
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
import { normalizePhone } from "./whatsapp/phone";

export interface CompanyScope {
  companyId: string;
}

const OPT_OUT_KEYWORDS = ["SAIR", "PARAR", "REMOVER", "CANCELAR"];

export function isOptOutMessage(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return OPT_OUT_KEYWORDS.includes(normalized);
}

/** JSON opcional para escrita no Prisma (undefined = não altera a coluna). */
function j(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null
    ? undefined
    : (value as Prisma.InputJsonValue);
}

export async function ensureDefaultTemplate(): Promise<void> {
  const sql = getSql();
  const existing = await sql.template.findUnique({
    where: { id: "confirmacao_agendamento" },
    select: { id: true },
  });
  if (existing) return;

  await sql.template.create({
    data: {
      id: "confirmacao_agendamento",
      name: "confirmacao_agendamento",
      language: "pt_BR",
      category: "utility",
      status: "approved",
      body: "Olá, {{1}}! Sua consulta na Mister Odonto está confirmada para {{2}} às {{3}}. Qualquer dúvida, responda esta mensagem.",
    },
  });
}

export async function findContactByPhone(
  phone: string,
  scope: CompanyScope
): Promise<Contact | null> {
  const target = safeNormalizePhone(phone);
  const row = await getSql().contact.findFirst({
    where: { companyId: scope.companyId, phoneNormalized: target },
  });
  return row ? contactFromRow(row) : null;
}

export async function createOrGetContactByPhone(
  phone: string,
  scope: CompanyScope,
  data?: Partial<Pick<Contact, "name" | "source" | "tags" | "optIn">>
): Promise<Contact> {
  const sql = getSql();
  const existing = await findContactByPhone(phone, scope);
  if (existing) {
    let normalizedPhone: string | undefined;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      normalizedPhone = undefined;
    }

    const updates: Prisma.ContactUpdateInput = {};
    let changed = false;
    if (data?.name && data.name !== existing.name) {
      updates.name = data.name;
      if (data.source !== undefined) updates.source = data.source;
      changed = true;
    }
    if (normalizedPhone && normalizedPhone !== existing.phone) {
      updates.phone = normalizedPhone;
      updates.phoneNormalized = normalizedPhone;
      changed = true;
    }
    if (changed) {
      const row = await sql.contact.update({
        where: { id: existing.id },
        data: updates,
      });
      return contactFromRow(row);
    }
    return existing;
  }

  // Upsert na chave composta: dois webhooks simultâneos do mesmo número novo
  // não criam duplicado (o segundo só lê a linha já criada).
  const storedPhone = safeNormalizePhone(phone);
  const row = await sql.contact.upsert({
    where: {
      companyId_phoneNormalized: {
        companyId: scope.companyId,
        phoneNormalized: storedPhone,
      },
    },
    create: {
      name: data?.name || storedPhone,
      phone: storedPhone,
      phoneNormalized: storedPhone,
      source: data?.source || "whatsapp",
      tags: (data?.tags || []) as Prisma.InputJsonValue,
      optIn: data?.optIn ?? true,
      blocked: false,
      archived: false,
      companyId: scope.companyId,
    },
    update: {},
  });
  return contactFromRow(row);
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
  const patch: Prisma.ContactUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.phone !== undefined) {
    patch.phone = data.phone;
    patch.phoneNormalized = safeNormalizePhone(data.phone);
  }
  if (data.source !== undefined) patch.source = data.source;
  if (data.tags !== undefined) patch.tags = data.tags as Prisma.InputJsonValue;
  if (data.optIn !== undefined) patch.optIn = data.optIn;
  if (data.blocked !== undefined) patch.blocked = data.blocked;
  if (data.archived !== undefined) patch.archived = data.archived;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.customFields !== undefined) {
    patch.customFields = data.customFields as Prisma.InputJsonValue;
  }
  if (data.originId !== undefined) patch.originId = data.originId;
  if (data.originFields !== undefined) {
    patch.originFields = data.originFields as Prisma.InputJsonValue;
  }
  if (data.leadClass !== undefined) patch.leadClass = data.leadClass;

  await getSql().contact.update({ where: { id }, data: patch });
}

export async function deleteContact(
  id: string,
  scope: CompanyScope
): Promise<boolean> {
  const result = await getSql().contact.deleteMany({
    where: { id, companyId: scope.companyId },
  });
  return result.count > 0;
}

export async function getContactById(
  id: string,
  scope: CompanyScope
): Promise<Contact | null> {
  const row = await getSql().contact.findFirst({
    where: { id, companyId: scope.companyId },
  });
  return row ? contactFromRow(row) : null;
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

export interface ContactListFilters {
  tag?: string;
  search?: string;
  archived?: boolean;
  originId?: string;
}

/** WHERE único de contatos — tag e busca resolvidas no banco (indexado). */
function contactsWhere(
  scope: CompanyScope,
  filters?: ContactListFilters
): Prisma.ContactWhereInput {
  const search = filters?.search?.trim();
  const digits = search ? search.replace(/\D/g, "") : "";
  return {
    companyId: scope.companyId,
    ...(filters?.archived !== undefined ? { archived: filters.archived } : {}),
    ...(filters?.originId ? { originId: filters.originId } : {}),
    ...(filters?.tag ? { tags: { array_contains: filters.tag } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            ...(digits.length >= 3
              ? [{ phoneNormalized: { contains: digits } }]
              : []),
          ],
        }
      : {}),
  };
}

export async function listContacts(
  scope: CompanyScope,
  filters?: ContactListFilters
): Promise<Contact[]> {
  const rows = await getSql().contact.findMany({
    where: contactsWhere(scope, filters),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(contactFromRow);
}

export async function listContactsPage(
  scope: CompanyScope,
  filters: ContactListFilters,
  page: { limit: number; offset: number }
): Promise<{ contacts: Contact[]; total: number }> {
  const where = contactsWhere(scope, filters);
  const sql = getSql();
  const [rows, total] = await Promise.all([
    sql.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: page.limit,
      skip: page.offset,
    }),
    sql.contact.count({ where }),
  ]);
  return { contacts: rows.map(contactFromRow), total };
}

/** Contadores por origem + universo de tags (tabs e filtros da tela de contatos). */
export async function getContactsAggregates(scope: CompanyScope): Promise<{
  countsByOrigin: Record<string, number>;
  total: number;
  tags: string[];
}> {
  const sql = getSql();
  const [grouped, total, tagRows] = await Promise.all([
    sql.contact.groupBy({
      by: ["originId"],
      where: { companyId: scope.companyId },
      _count: { _all: true },
    }),
    sql.contact.count({ where: { companyId: scope.companyId } }),
    sql.contact.findMany({
      where: { companyId: scope.companyId },
      select: { tags: true },
    }),
  ]);

  const countsByOrigin: Record<string, number> = {};
  for (const group of grouped) {
    if (group.originId) countsByOrigin[group.originId] = group._count._all;
  }

  const tags = new Set<string>();
  for (const row of tagRows) {
    if (!Array.isArray(row.tags)) continue;
    for (const tag of row.tags) {
      if (typeof tag === "string" && tag) tags.add(tag);
    }
  }

  return { countsByOrigin, total, tags: [...tags].sort() };
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

  async function applyDuplicatePolicy(
    existing: Contact,
    row: (typeof rows)[number]
  ): Promise<void> {
    if (policy === "skip") {
      skipped++;
      return;
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
  }

  for (const row of rows) {
    const existing = await findContactByPhone(row.phone, scope);
    if (existing) {
      await applyDuplicatePolicy(existing, row);
      continue;
    }

    try {
      await createContactManual(row, scope);
      created++;
    } catch (error) {
      // Corrida com webhook/outro import: o telefone surgiu entre o find e o
      // create — recarrega e aplica a política de duplicado normalmente.
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("Já existe")) throw error;
      const raced = await findContactByPhone(row.phone, scope);
      if (raced) {
        await applyDuplicatePolicy(raced, row);
      } else {
        skipped++;
      }
    }
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

  try {
    const row = await getSql().contact.create({
      data: {
        name: data.name,
        phone: normalizedPhone,
        phoneNormalized: normalizedPhone,
        source: data.source,
        tags: (data.tags || []) as Prisma.InputJsonValue,
        optIn: data.optIn,
        notes: data.notes,
        customFields: j(data.customFields),
        originId: data.originId,
        originFields: j(data.originFields),
        leadClass: data.leadClass ?? undefined,
        blocked: false,
        archived: false,
        companyId: scope.companyId,
      },
    });
    return contactFromRow(row);
  } catch (error) {
    // Corrida: outro request criou o mesmo telefone entre o find e o create.
    if (isUniqueConstraintError(error)) {
      throw new Error("Já existe um contato com este telefone.");
    }
    throw error;
  }
}

/** Violação de índice único (P2002) do Prisma. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function findConversationByPhone(
  phone: string,
  scope: CompanyScope
): Promise<Conversation | null> {
  const target = safeNormalizePhone(phone);
  const row = await getSql().conversation.findFirst({
    where: { companyId: scope.companyId, phoneNormalized: target },
    orderBy: { lastMessageAt: "desc" },
  });
  return row ? conversationFromRow(row) : null;
}

export async function createOrGetConversationByPhone(
  phone: string,
  contactId: string,
  scope: CompanyScope
): Promise<Conversation> {
  const sql = getSql();
  const storedPhone = safeNormalizePhone(phone);
  const existing = await findConversationByPhone(phone, scope);
  if (existing) {
    if (storedPhone !== existing.phone || existing.contactId !== contactId) {
      await sql.conversation.update({
        where: { id: existing.id },
        data: { phone: storedPhone, phoneNormalized: storedPhone, contactId },
      });
      return { ...existing, phone: storedPhone, contactId };
    }
    return existing;
  }

  const row = await sql.conversation.create({
    data: {
      contactId,
      phone: storedPhone,
      phoneNormalized: storedPhone,
      status: "open",
      lastMessageAt: new Date(),
      unreadCount: 0,
      companyId: scope.companyId,
    },
  });
  return conversationFromRow(row);
}

export async function getConversationById(
  id: string,
  scope: CompanyScope
): Promise<Conversation | null> {
  const row = await getSql().conversation.findFirst({
    where: { id, companyId: scope.companyId },
  });
  return row ? conversationFromRow(row) : null;
}

export async function deleteConversation(
  id: string,
  scope: CompanyScope
): Promise<boolean> {
  const sql = getSql();
  const conversation = await getConversationById(id, scope);
  if (!conversation) return false;

  // Mensagens caem por cascade; refs de WhatsApp são limpas por conversationId.
  await sql.whatsAppMessageRef.deleteMany({ where: { conversationId: id } });
  await sql.conversation.delete({ where: { id } });

  return true;
}

export async function updateConversationLastMessage(
  conversationId: string,
  preview: string,
  inbound = false
): Promise<void> {
  const now = new Date();
  await getSql().conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: now,
      lastMessagePreview: preview,
      ...(inbound
        ? {
            lastInboundAt: now,
            unreadCount: { increment: 1 },
            status: "open",
          }
        : {}),
    },
  });
}

export async function updateConversationStatus(
  conversationId: string,
  status: Conversation["status"],
  options?: { markRead?: boolean }
): Promise<void> {
  await getSql().conversation.update({
    where: { id: conversationId },
    data: {
      status,
      ...(options?.markRead && status === "closed" ? { unreadCount: 0 } : {}),
    },
  });
}

export async function updateConversationAssignment(
  conversationId: string,
  assignedTo: string | null,
  scope: CompanyScope
): Promise<void> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) throw new Error("Conversa não encontrada.");

  await getSql().conversation.update({
    where: { id: conversationId },
    data: assignedTo
      ? { assignedTo, assignedAt: new Date() }
      : { assignedTo: null, assignedAt: null },
  });
}

export async function listContactLists(
  scope: CompanyScope
): Promise<ContactList[]> {
  const rows = await getSql().contactList.findMany({
    where: { companyId: scope.companyId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(contactListFromRow);
}

export async function createContactList(
  data: Pick<ContactList, "name" | "description" | "tagFilter" | "contactIds">,
  scope: CompanyScope
): Promise<ContactList> {
  const row = await getSql().contactList.create({
    data: {
      name: data.name,
      description: data.description,
      tagFilter: j(data.tagFilter),
      contactIds: (data.contactIds || []) as Prisma.InputJsonValue,
      companyId: scope.companyId,
    },
  });
  return contactListFromRow(row);
}

export async function updateContactList(
  listId: string,
  data: Partial<Pick<ContactList, "name" | "description" | "tagFilter" | "contactIds">>,
  scope: CompanyScope
): Promise<ContactList | null> {
  const sql = getSql();
  const existing = await sql.contactList.findFirst({
    where: { id: listId, companyId: scope.companyId },
  });
  if (!existing) return null;

  const row = await sql.contactList.update({
    where: { id: listId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.tagFilter !== undefined
        ? { tagFilter: data.tagFilter as Prisma.InputJsonValue }
        : {}),
      ...(data.contactIds !== undefined
        ? { contactIds: data.contactIds as Prisma.InputJsonValue }
        : {}),
    },
  });
  return contactListFromRow(row);
}

export async function deleteContactList(
  listId: string,
  scope: CompanyScope
): Promise<boolean> {
  const result = await getSql().contactList.deleteMany({
    where: { id: listId, companyId: scope.companyId },
  });
  return result.count > 0;
}

export async function getContactsForList(
  listId: string,
  scope: CompanyScope
): Promise<Contact[]> {
  const sql = getSql();
  const listRow = await sql.contactList.findFirst({
    where: { id: listId, companyId: scope.companyId },
  });
  if (!listRow) return [];
  const list = contactListFromRow(listRow);

  if (list.contactIds?.length) {
    const rows = await sql.contact.findMany({
      where: {
        id: { in: list.contactIds },
        companyId: scope.companyId,
        blocked: false,
        optIn: true,
      },
    });
    return rows.map(contactFromRow);
  }

  const rows = await sql.contact.findMany({
    where: { companyId: scope.companyId, blocked: false, optIn: true },
  });
  const contacts = rows.map(contactFromRow);

  if (list.tagFilter?.length) {
    return contacts.filter((c) =>
      list.tagFilter!.some((tag) => c.tags?.includes(tag))
    );
  }

  return contacts;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await getSql().conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });
}

export async function markConversationUnread(conversationId: string): Promise<void> {
  await getSql().conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 1 },
  });
}

export async function updateConversationConnection(
  conversationId: string,
  connectionId: string
): Promise<void> {
  await getSql().conversation.update({
    where: { id: conversationId },
    data: { connectionId },
  });
}

export async function updateConversationLabels(
  conversationId: string,
  labels: string[],
  scope: CompanyScope
): Promise<void> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) throw new Error("Conversa não encontrada.");
  const clean = [...new Set(labels.map((l) => l.trim()).filter(Boolean))].slice(0, 20);
  await getSql().conversation.update({
    where: { id: conversationId },
    data: { labels: clean as Prisma.InputJsonValue },
  });
}

/** Nota interna do time — entra na timeline, nunca é enviada ao contato. */
export async function saveInternalNote(
  conversationId: string,
  body: string,
  sender: { sentByUid?: string; sentByName?: string },
  scope: CompanyScope
): Promise<Message | null> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return null;

  const row = await getSql().message.create({
    data: {
      conversationId,
      contactId: conversation.contactId,
      companyId: scope.companyId,
      direction: "outbound",
      type: "note",
      body,
      status: "accepted",
      sentByUid: sender.sentByUid,
      sentByName: sender.sentByName,
      createdAt: new Date(),
    },
  });

  const { publishRealtime } = await import("./realtime");
  publishRealtime(scope.companyId, {
    type: "message:new",
    conversationId,
    direction: "outbound",
  });

  return messageFromRow(row);
}

/**
 * Auditoria (LGPD): registra que um supervisor (gerente/líder) abriu uma conversa.
 * Chamado fire-and-forget — falha aqui nunca deve derrubar a leitura do chat.
 */
export async function logConversationAccess(
  conversationId: string,
  actor: { uid?: string | null; name?: string | null; role: string },
  scope: CompanyScope
): Promise<void> {
  await getSql().conversationAccessLog.create({
    data: {
      companyId: scope.companyId,
      conversationId,
      userUid: actor.uid ?? null,
      userName: actor.name ?? null,
      role: actor.role,
    },
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
  const sql = getSql();
  const conversation = await sql.conversation.findUnique({
    where: { id: data.conversationId },
    select: { companyId: true },
  });

  const row = await sql.message.create({
    data: {
      conversationId: data.conversationId,
      contactId: data.contactId,
      companyId: conversation?.companyId,
      whatsappMessageId: data.whatsappMessageId,
      direction: "inbound",
      type: data.type,
      body: data.body,
      status: data.status || "received",
      media: j(data.media),
      templateName: data.templateName,
      templateParameters: j(data.templateParameters),
      templateRenderedBody: data.templateRenderedBody,
      templateFooter: data.templateFooter,
      templateButtons: j(data.templateButtons),
      replyTo: j(data.replyTo),
      reactions: j(data.reactions),
      interactivePayload: data.interactivePayload,
      rawPayload: j(data.rawPayload),
      statusError: data.statusError,
      connectionId: data.connectionId,
      sentByUid: data.sentByUid,
      sentByName: data.sentByName,
      createdAt: new Date(),
    },
  });

  await updateConversationLastMessage(data.conversationId, data.body, true);

  if (data.whatsappMessageId && conversation?.companyId) {
    const { saveWhatsAppMessageRef } = await import("./whatsapp-message-refs");
    await saveWhatsAppMessageRef({
      whatsappMessageId: data.whatsappMessageId,
      companyId: conversation.companyId,
      conversationId: data.conversationId,
      messageId: row.id,
    });
  }

  if (conversation?.companyId) {
    const { publishRealtime } = await import("./realtime");
    publishRealtime(conversation.companyId, {
      type: "message:new",
      conversationId: data.conversationId,
      direction: "inbound",
    });
  }

  return messageFromRow(row);
}

export async function saveOutboundMessage(
  data: Omit<Message, "id" | "createdAt" | "direction"> & {
    direction?: Message["direction"];
  }
): Promise<Message> {
  const sql = getSql();
  const conversation = await sql.conversation.findUnique({
    where: { id: data.conversationId },
    select: { companyId: true, firstResponseAt: true },
  });

  const now = new Date();
  const row = await sql.message.create({
    data: {
      conversationId: data.conversationId,
      contactId: data.contactId,
      companyId: conversation?.companyId,
      whatsappMessageId: data.whatsappMessageId,
      direction: data.direction || "outbound",
      type: data.type,
      body: data.body,
      status: data.status,
      media: j(data.media),
      templateName: data.templateName,
      templateParameters: j(data.templateParameters),
      templateRenderedBody: data.templateRenderedBody,
      templateFooter: data.templateFooter,
      templateButtons: j(data.templateButtons),
      replyTo: j(data.replyTo),
      reactions: j(data.reactions),
      interactivePayload: data.interactivePayload,
      rawPayload: j(data.rawPayload),
      statusError: data.statusError,
      connectionId: data.connectionId,
      sentByUid: data.sentByUid,
      sentByName: data.sentByName,
      createdAt: now,
    },
  });

  await updateConversationLastMessage(data.conversationId, data.body, false);

  if (conversation && !conversation.firstResponseAt) {
    await sql.conversation.update({
      where: { id: data.conversationId },
      data: { firstResponseAt: now },
    });
  }

  if (data.whatsappMessageId && conversation?.companyId) {
    const { saveWhatsAppMessageRef } = await import("./whatsapp-message-refs");
    await saveWhatsAppMessageRef({
      whatsappMessageId: data.whatsappMessageId,
      companyId: conversation.companyId,
      conversationId: data.conversationId,
      messageId: row.id,
    });
  }

  if (conversation?.companyId) {
    const { publishRealtime } = await import("./realtime");
    publishRealtime(conversation.companyId, {
      type: "message:new",
      conversationId: data.conversationId,
      direction: "outbound",
    });
  }

  return messageFromRow(row);
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

  await getSql().message.update({
    where: { id: known.messageId },
    data: {
      status,
      statusError: statusError ?? (status !== "failed" ? null : undefined),
    },
  });

  const { publishRealtime } = await import("./realtime");
  publishRealtime(known.companyId, {
    type: "message:status",
    conversationId: known.conversationId,
  });
}

export async function updateMessageAfterResend(
  conversationId: string,
  messageId: string,
  data: {
    whatsappMessageId?: string;
    status: Message["status"];
    rawPayload?: unknown;
    statusError?: string | null;
  }
): Promise<void> {
  await getSql().message.updateMany({
    where: { id: messageId, conversationId },
    data: {
      status: data.status,
      ...(data.whatsappMessageId
        ? { whatsappMessageId: data.whatsappMessageId }
        : {}),
      ...(data.rawPayload !== undefined
        ? { rawPayload: data.rawPayload as Prisma.InputJsonValue }
        : {}),
      ...(data.statusError !== undefined ? { statusError: data.statusError } : {}),
    },
  });
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
    /** Etiqueta da conversa (labels), distinta das tags do contato. */
    label?: string;
  }
): Promise<ConversationListItem[]> {
  const sql = getSql();

  let periodRange: { start: Date; end: Date } | null = null;
  if (filters?.period) {
    const now = new Date();
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());

    switch (filters.period) {
      case "today":
        periodRange = { start: startOfDay(now), end: now };
        break;
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        periodRange = { start: startOfDay(y), end: startOfDay(now) };
        break;
      }
      case "7d":
        periodRange = {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now,
        };
        break;
      case "30d":
        periodRange = {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now,
        };
        break;
    }
  }

  const rows = await sql.conversation.findMany({
    where: {
      companyId: scope.companyId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.unreadOnly ? { unreadCount: { gt: 0 } } : {}),
      ...(filters?.assignedTo === "__unassigned__"
        ? { assignedTo: null }
        : filters?.assignedTo
          ? { assignedTo: filters.assignedTo }
          : {}),
      ...(periodRange
        ? { lastMessageAt: { gte: periodRange.start, lte: periodRange.end } }
        : {}),
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // Uma thread por telefone — evita duplicatas na lista e cliques em conversa vazia.
  // As linhas vêm ordenadas por lastMessageAt desc; a primeira de cada telefone é a mais recente.
  const byPhone = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = row.phoneNormalized || row.phone;
    if (!byPhone.has(key)) byPhone.set(key, row);
  }
  let conversations = [...byPhone.values()]
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    .map(conversationFromRow);

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

  const contactIds = [...new Set(conversations.map((c) => c.contactId))];
  const contactMap = new Map<string, { name: string; tags: string[] }>();

  if (contactIds.length > 0) {
    const contactRows = await sql.contact.findMany({
      where: { id: { in: contactIds }, companyId: scope.companyId },
      select: { id: true, name: true, tags: true },
    });
    for (const contact of contactRows) {
      contactMap.set(contact.id, {
        name: contact.name,
        tags: (contact.tags as string[] | null) || [],
      });
    }
  }

  if (filters?.tag) {
    conversations = conversations.filter((c) => {
      const contact = contactMap.get(c.contactId);
      return contact?.tags?.includes(filters.tag!);
    });
  }

  if (filters?.label) {
    conversations = conversations.filter((c) =>
      c.labels?.includes(filters.label!)
    );
  }

  if (filters?.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) {
      // Busca também no corpo das mensagens (histórico), não só nome/telefone.
      const messageMatches = await sql.message.findMany({
        where: {
          companyId: scope.companyId,
          body: { contains: q },
        },
        select: { conversationId: true },
        distinct: ["conversationId"],
        take: 200,
      });
      const matchedByMessage = new Set(
        messageMatches.map((m) => m.conversationId)
      );

      conversations = conversations.filter((c) => {
        const contact = contactMap.get(c.contactId);
        const name = (contact?.name || "").toLowerCase();
        return (
          name.includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          matchedByMessage.has(c.id)
        );
      });
    }
  }

  if (filters?.noResponseOnly) {
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
  const sql = getSql();
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return { messages: [], hasMore: false };

  if (!options?.limit && !options?.before) {
    const rows = await sql.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    return { messages: rows.map(messageFromRow), hasMore: false };
  }

  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const rows = await sql.message.findMany({
    where: {
      conversationId,
      ...(options.before ? { createdAt: { lt: new Date(options.before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const messages = slice.map(messageFromRow).reverse();

  return { messages, hasMore };
}

export async function getConversationMessage(
  conversationId: string,
  messageId: string,
  scope: CompanyScope
): Promise<Message | null> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return null;

  const row = await getSql().message.findFirst({
    where: { id: messageId, conversationId },
  });
  return row ? messageFromRow(row) : null;
}

export async function applyMessageReaction(
  conversationId: string,
  messageId: string,
  reaction: MessageReaction,
  scope: CompanyScope
): Promise<void> {
  const sql = getSql();
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return;

  const row = await sql.message.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!row) return;

  const existing = messageFromRow(row);
  const reactions = [...(existing.reactions || [])];
  const index = reactions.findIndex((item) => item.from === reaction.from);

  if (!reaction.emoji.trim()) {
    if (index >= 0) reactions.splice(index, 1);
  } else if (index >= 0) {
    reactions[index] = reaction;
  } else {
    reactions.push(reaction);
  }

  await sql.message.update({
    where: { id: messageId },
    data: { reactions: reactions as unknown as Prisma.InputJsonValue },
  });
}

export async function updateConversationMessageMedia(
  conversationId: string,
  messageId: string,
  media: Message["media"],
  scope: CompanyScope
): Promise<void> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return;

  await getSql().message.updateMany({
    where: { id: messageId, conversationId },
    data: { media: media as unknown as Prisma.InputJsonValue },
  });
}

export async function markMessageDeleted(
  conversationId: string,
  messageId: string,
  scope: CompanyScope
): Promise<void> {
  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return;

  await getSql().message.updateMany({
    where: { id: messageId, conversationId },
    data: { deletedAt: new Date(), body: "" },
  });
}

export async function listTemplates(): Promise<Template[]> {
  await ensureDefaultTemplate();
  const rows = await getSql().template.findMany({ orderBy: { name: "asc" } });
  return rows.map(templateFromRow);
}

export async function getDashboardStats(scope: CompanyScope): Promise<DashboardStats> {
  const sql = getSql();
  const companyId = scope.companyId;

  const [totalContacts, totalConversations, messagesSent, messagesReceived, messagesFailed] =
    await Promise.all([
      sql.contact.count({ where: { companyId } }),
      sql.conversation.count({ where: { companyId } }),
      sql.message.count({ where: { companyId, direction: "outbound" } }),
      sql.message.count({ where: { companyId, direction: "inbound" } }),
      sql.message.count({ where: { companyId, status: "failed" } }),
    ]);

  return {
    totalContacts,
    totalConversations,
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
  await getSql().integrationEvent.create({
    data: {
      source,
      payload: j(payload),
      status,
      companyId: scope.companyId,
    },
  });
}
