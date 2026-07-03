import type { ProviderType } from "./whatsapp/types";

const WINDOW_MS = 24 * 60 * 60 * 1000;

type TimestampLike =
  | { toMillis?: () => number; toDate?: () => Date; seconds?: number; _seconds?: number }
  | string
  | number
  | null
  | undefined;

export function toMillis(value: TimestampLike): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  return null;
}

export function toDate(value: TimestampLike): Date | null {
  const ms = toMillis(value);
  return ms == null ? null : new Date(ms);
}

export function isWithinConversationWindow(
  lastInboundAt?: TimestampLike,
  now = Date.now()
): boolean {
  const lastMs = toMillis(lastInboundAt);
  if (lastMs == null) return false;
  return now - lastMs <= WINDOW_MS;
}

export function conversationWindowMessage(): string {
  return "A janela de atendimento de 24 horas está fechada. Envie um template aprovado ou aguarde uma nova mensagem do contato.";
}

/** Meta exige janela de 24h; Evolution/Wasender não têm essa restrição. */
export function isActionableConversationWindow(
  lastInboundAt: TimestampLike,
  provider: ProviderType,
  now = Date.now()
): boolean {
  if (provider !== "meta_cloud") return true;
  return isWithinConversationWindow(lastInboundAt, now);
}
