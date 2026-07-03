import type { Message } from "./types";
import { toDate } from "./conversation-window";

export function messageCreatedAtMs(message: Message): number {
  const date = toDate(message.createdAt as Parameters<typeof toDate>[0]);
  return date?.getTime() ?? 0;
}

export function mergeMessagesById(
  existing: Message[],
  incoming: Message[]
): Message[] {
  const map = new Map<string, Message>();
  for (const message of existing) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return [...map.values()].sort(
    (a, b) => messageCreatedAtMs(a) - messageCreatedAtMs(b)
  );
}

export function oldestMessageCursor(messages: Message[]): number | undefined {
  if (messages.length === 0) return undefined;
  return messageCreatedAtMs(messages[0]!);
}
