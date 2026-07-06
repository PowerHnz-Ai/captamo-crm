import { getSql } from "./db";
import type { DateMillis } from "./types";

export interface WhatsAppMessageRef {
  companyId: string;
  conversationId: string;
  messageId: string;
  updatedAt: DateMillis;
}

function sanitizeWhatsAppMessageRefId(id?: string): string | null {
  if (!id || typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  return trimmed;
}

export async function saveWhatsAppMessageRef(params: {
  whatsappMessageId: string;
  companyId: string;
  conversationId: string;
  messageId: string;
}): Promise<void> {
  const whatsappMessageId = sanitizeWhatsAppMessageRefId(params.whatsappMessageId);
  if (!whatsappMessageId) return;

  await getSql().whatsAppMessageRef.upsert({
    where: { whatsappMessageId },
    create: {
      whatsappMessageId,
      companyId: params.companyId,
      conversationId: params.conversationId,
      messageId: params.messageId,
    },
    update: {
      companyId: params.companyId,
      conversationId: params.conversationId,
      messageId: params.messageId,
    },
  });
}

export async function resolveWhatsAppMessageRef(
  whatsappMessageId: string
): Promise<WhatsAppMessageRef | null> {
  const id = sanitizeWhatsAppMessageRefId(whatsappMessageId);
  if (!id) return null;

  const row = await getSql().whatsAppMessageRef.findUnique({
    where: { whatsappMessageId: id },
  });
  if (!row) return null;
  return {
    companyId: row.companyId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    updatedAt: row.updatedAt.getTime(),
  };
}

/** @deprecated Herança do Firestore — mantido para compatibilidade de import. */
export function isFirestoreIndexError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: number }).code;
  const details = String((error as { details?: string }).details || "");
  return code === 9 || details.includes("requires an index");
}
