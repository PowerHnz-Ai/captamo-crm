import { getSql } from "./db";
import type { DateMillis } from "./types";

export interface DailyStats {
  id: string;
  companyId: string;
  date: string;
  templatesSent: number;
  messagesSent: number;
  messagesReceived: number;
  messagesDelivered: number;
  messagesRead: number;
  messagesFailed: number;
  optOuts: number;
  uniqueRecipients24h: number;
  updatedAt: DateMillis;
}

type DailyStatsCounter =
  | "templatesSent"
  | "messagesSent"
  | "messagesReceived"
  | "messagesDelivered"
  | "messagesRead"
  | "messagesFailed"
  | "optOuts"
  | "uniqueRecipients24h";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function docId(companyId: string, date?: string) {
  return `${companyId}_${date || todayKey()}`;
}

export async function incrementDailyStats(
  companyId: string,
  delta: Partial<Record<DailyStatsCounter, number>>
): Promise<void> {
  const date = todayKey();
  const increments: Partial<Record<DailyStatsCounter, { increment: number }>> = {};
  const initial: Partial<Record<DailyStatsCounter, number>> = {};

  for (const [key, value] of Object.entries(delta) as Array<
    [DailyStatsCounter, number]
  >) {
    if (value && value > 0) {
      increments[key] = { increment: value };
      initial[key] = value;
    }
  }

  await getSql().dailyStats.upsert({
    where: { companyId_date: { companyId, date } },
    create: {
      id: docId(companyId, date),
      companyId,
      date,
      ...initial,
    },
    update: increments,
  });
}

export async function getDailyStats(
  companyId: string,
  date?: string
): Promise<DailyStats | null> {
  const row = await getSql().dailyStats.findUnique({
    where: { companyId_date: { companyId, date: date || todayKey() } },
  });
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.companyId,
    date: row.date,
    templatesSent: row.templatesSent,
    messagesSent: row.messagesSent,
    messagesReceived: row.messagesReceived,
    messagesDelivered: row.messagesDelivered,
    messagesRead: row.messagesRead,
    messagesFailed: row.messagesFailed,
    optOuts: row.optOuts,
    uniqueRecipients24h: row.uniqueRecipients24h,
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function getStatsRange(
  companyId: string,
  days: number
): Promise<DailyStats[]> {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10).replace(/-/g, ""));
  }

  const rows = await getSql().dailyStats.findMany({
    where: { companyId, date: { in: keys } },
    orderBy: { date: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    companyId: row.companyId,
    date: row.date,
    templatesSent: row.templatesSent,
    messagesSent: row.messagesSent,
    messagesReceived: row.messagesReceived,
    messagesDelivered: row.messagesDelivered,
    messagesRead: row.messagesRead,
    messagesFailed: row.messagesFailed,
    optOuts: row.optOuts,
    uniqueRecipients24h: row.uniqueRecipients24h,
    updatedAt: row.updatedAt.getTime(),
  }));
}

export async function aggregateStatsRange(
  companyId: string,
  days: number
) {
  const range = await getStatsRange(companyId, days);
  return range.reduce(
    (acc, day) => ({
      templatesSent: acc.templatesSent + (day.templatesSent || 0),
      messagesSent: acc.messagesSent + (day.messagesSent || 0),
      messagesReceived: acc.messagesReceived + (day.messagesReceived || 0),
      messagesDelivered:
        acc.messagesDelivered + (day.messagesDelivered || 0),
      messagesRead: acc.messagesRead + (day.messagesRead || 0),
      messagesFailed: acc.messagesFailed + (day.messagesFailed || 0),
      optOuts: acc.optOuts + (day.optOuts || 0),
    }),
    {
      templatesSent: 0,
      messagesSent: 0,
      messagesReceived: 0,
      messagesDelivered: 0,
      messagesRead: 0,
      messagesFailed: 0,
      optOuts: 0,
    }
  );
}
