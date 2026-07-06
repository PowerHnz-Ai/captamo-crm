import { getSql } from "./db";
import type { DateMillis } from "./types";

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
  createdAt: DateMillis;
}

export async function logWebhookEvent(
  data: Omit<WebhookEventLog, "id" | "createdAt">
): Promise<void> {
  try {
    await getSql().webhookEvent.create({
      data: {
        companyId: data.companyId,
        provider: data.provider,
        eventType: data.eventType,
        phone: data.phone,
        messageId: data.messageId,
        status: data.status,
        error: data.error,
        eventCount: data.eventCount,
      },
    });
  } catch (error) {
    console.error("[webhook-log] Falha ao persistir evento:", error);
  }
}

export async function listRecentWebhookEvents(
  companyId: string,
  limit = 15
): Promise<WebhookEventLog[]> {
  const rows = await getSql().webhookEvent.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    companyId: row.companyId,
    provider: row.provider,
    eventType: row.eventType,
    phone: row.phone ?? undefined,
    messageId: row.messageId ?? undefined,
    status: row.status as WebhookEventStatus,
    error: row.error ?? undefined,
    eventCount: row.eventCount ?? undefined,
    createdAt: row.createdAt.getTime(),
  }));
}
