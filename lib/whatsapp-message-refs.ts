import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";

export interface WhatsAppMessageRef {
  companyId: string;
  conversationId: string;
  messageId: string;
  updatedAt: Timestamp;
}

export async function saveWhatsAppMessageRef(params: {
  whatsappMessageId: string;
  companyId: string;
  conversationId: string;
  messageId: string;
}): Promise<void> {
  if (!params.whatsappMessageId) return;

  await getDb()
    .collection("whatsapp_message_refs")
    .doc(params.whatsappMessageId)
    .set({
      companyId: params.companyId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      updatedAt: Timestamp.now(),
    });
}

export async function resolveWhatsAppMessageRef(
  whatsappMessageId: string
): Promise<WhatsAppMessageRef | null> {
  const doc = await getDb()
    .collection("whatsapp_message_refs")
    .doc(whatsappMessageId)
    .get();

  if (!doc.exists) return null;
  return doc.data() as WhatsAppMessageRef;
}

export function isFirestoreIndexError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: number }).code;
  const details = String((error as { details?: string }).details || "");
  return code === 9 || details.includes("requires an index");
}
