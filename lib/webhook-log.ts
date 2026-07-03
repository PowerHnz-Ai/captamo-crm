import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";

export type WebhookEventStatus = "received" | "processed" | "error";

export interface WebhookEventLog {
  id: string;
  companyId: string;
  provider: string;
  eventType: string;
  phone?: string;
  messageId?: string;
  status: WebhookEventStatus;
  error?: string;
  eventCount?: number;
  createdAt: Timestamp;
}

export async function logWebhookEvent(
  data: Omit<WebhookEventLog, "id" | "createdAt">
): Promise<void> {
  try {
    const ref = getDb().collection("webhook_events").doc();
    await ref.set({
      id: ref.id,
      ...data,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("[webhook-log] Falha ao persistir evento:", error);
  }
}

export async function listRecentWebhookEvents(
  companyId: string,
  limit = 15
): Promise<WebhookEventLog[]> {
  const snap = await getDb()
    .collection("webhook_events")
    .where("companyId", "==", companyId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as WebhookEventLog);
}
