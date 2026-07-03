import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";

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
  updatedAt: Timestamp;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function docId(companyId: string, date?: string) {
  return `${companyId}_${date || todayKey()}`;
}

export async function incrementDailyStats(
  companyId: string,
  delta: Partial<
    Record<
      | "templatesSent"
      | "messagesSent"
      | "messagesReceived"
      | "messagesDelivered"
      | "messagesRead"
      | "messagesFailed"
      | "optOuts"
      | "uniqueRecipients24h",
      number
    >
  >
): Promise<void> {
  const ref = getDb().collection("stats_daily").doc(docId(companyId));
  const update: Record<string, unknown> = {
    companyId,
    date: todayKey(),
    updatedAt: Timestamp.now(),
  };

  for (const [key, value] of Object.entries(delta)) {
    if (value && value > 0) {
      update[key] = FieldValue.increment(value);
    }
  }

  await ref.set(update, { merge: true });
}

export async function getDailyStats(
  companyId: string,
  date?: string
): Promise<DailyStats | null> {
  const doc = await getDb()
    .collection("stats_daily")
    .doc(docId(companyId, date))
    .get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as DailyStats;
}

export async function getStatsRange(
  companyId: string,
  days: number
): Promise<DailyStats[]> {
  const results: DailyStats[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10).replace(/-/g, "");
    const stats = await getDailyStats(companyId, key);
    if (stats) results.push(stats);
  }

  return results.reverse();
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
