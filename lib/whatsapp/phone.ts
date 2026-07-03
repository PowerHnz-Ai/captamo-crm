import { WhatsAppProviderError } from "./types";

function digitsOnly(phone: string): string {
  return phone.replace(/[\s+\-()]/g, "");
}

/** Insere o 9º dígito em celulares BR quando informado no formato antigo (DDD + 8 dígitos). */
export function normalizeBrazilMobile(phone: string): string {
  if (!phone.startsWith("55")) return phone;

  const national = phone.slice(2);
  if (national.length !== 10) return phone;

  const ddd = national.slice(0, 2);
  const subscriber = national.slice(2);
  if (!/^\d{2}$/.test(ddd) || !/^\d{8}$/.test(subscriber)) return phone;

  // Celular sem o 9 inicial (ex.: 2299836965 → 22999836965)
  if (subscriber.startsWith("9")) return phone;
  return `55${ddd}9${subscriber}`;
}

export function normalizePhone(phone: string): string {
  let normalized = digitsOnly(phone);

  if (!/^\d{10,15}$/.test(normalized)) {
    throw new WhatsAppProviderError(
      "Telefone inválido. Use formato internacional sem símbolos, ex: 5522999999999."
    );
  }

  normalized = normalizeBrazilMobile(normalized);

  if (normalized.startsWith("55") && !/^55\d{10,11}$/.test(normalized)) {
    throw new WhatsAppProviderError(
      "Telefone brasileiro inválido. Use DDI 55 + DDD + número, ex: 5522999999999."
    );
  }

  return normalized;
}

export function phonesMatch(a: string, b: string): boolean {
  try {
    return normalizePhone(a) === normalizePhone(b);
  } catch {
    return digitsOnly(a) === digitsOnly(b);
  }
}

export function extractResolvedWhatsAppId(response: unknown): string | undefined {
  const data = response as {
    contacts?: Array<{ wa_id?: string; input?: string }>;
  };
  return data.contacts?.[0]?.wa_id;
}

export function extractMessageStatus(response: unknown): string | undefined {
  const data = response as {
    messages?: Array<{ message_status?: string }>;
  };
  return data.messages?.[0]?.message_status;
}

export function extractMessageId(response: unknown): string | undefined {
  const data = response as {
    messages?: Array<{ id?: string }>;
    key?: { id?: string };
    messageId?: string;
    id?: string;
  };
  return (
    data.messages?.[0]?.id ||
    data.key?.id ||
    data.messageId ||
    data.id
  );
}
