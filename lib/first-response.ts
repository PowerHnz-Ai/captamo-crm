import { differenceInMinutes } from "date-fns";
import { toDate } from "./conversation-window";

type TimestampLike = { toMillis?: () => number; seconds?: number };

export function formatFirstResponseTime(
  firstResponseAt?: TimestampLike,
  createdAt?: TimestampLike
): string | null {
  if (!firstResponseAt) return null;
  const responseDate = toDate(firstResponseAt as Parameters<typeof toDate>[0]);
  if (!responseDate) return null;

  const startDate = createdAt
    ? toDate(createdAt as Parameters<typeof toDate>[0])
    : null;

  if (!startDate) {
    return responseDate.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const mins = differenceInMinutes(responseDate, startDate);
  if (mins < 1) return "Menos de 1 min";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`;
}
