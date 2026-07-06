import { getDefaultCompanyId } from "./auth-server";
import {
  extractMetaPhoneNumberId,
  resolveCompanyByInstanceId,
  resolveCompanyByPhoneNumberId,
  resolveCompanyByWasenderSession,
} from "./companies";
import { resolveConnectionByInstanceId } from "./connections";

export interface WebhookTarget {
  companyId: string;
  connectionId?: string;
}

async function resolveEvolutionTarget(
  instance: string
): Promise<WebhookTarget | null> {
  const legacyCompanyId = await resolveCompanyByInstanceId(instance);
  if (legacyCompanyId) {
    const connection = await resolveConnectionByInstanceId(
      legacyCompanyId,
      instance
    );
    return { companyId: legacyCompanyId, connectionId: connection?.id };
  }

  const defaultCompanyId = getDefaultCompanyId();
  const connection = await resolveConnectionByInstanceId(
    defaultCompanyId,
    instance
  );
  if (connection) {
    return { companyId: defaultCompanyId, connectionId: connection.id };
  }

  return null;
}

/**
 * Retorna null quando o evento não pertence a nenhuma empresa cadastrada
 * (ex.: phoneNumberId da Meta desconhecido) — o caller deve responder 200 e
 * descartar, sem cair na empresa default de outra clínica.
 */
export async function resolveWebhookTarget(
  provider: "meta" | "wasender" | "evolution",
  payload: unknown
): Promise<WebhookTarget | null> {
  if (provider === "meta") {
    const phoneNumberId = extractMetaPhoneNumberId(payload);
    if (phoneNumberId) {
      const companyId = await resolveCompanyByPhoneNumberId(phoneNumberId);
      if (companyId) return { companyId };
      console.warn(
        "[webhook] phoneNumberId sem empresa cadastrada — evento descartado:",
        phoneNumberId
      );
      return null;
    }
  }

  if (provider === "evolution") {
    const data = payload as { instance?: string };
    if (data.instance) {
      const target = await resolveEvolutionTarget(data.instance);
      if (target) return target;
    }
  }

  if (provider === "wasender") {
    const data = payload as { data?: { session?: string }; sessionId?: string };
    const session = data.data?.session || data.sessionId;
    if (session) {
      const companyId = await resolveCompanyByWasenderSession(session);
      if (companyId) {
        const connection = await resolveConnectionByInstanceId(
          companyId,
          session
        );
        return { companyId, connectionId: connection?.id };
      }
    }
  }

  return { companyId: getDefaultCompanyId() };
}

/** @deprecated Use resolveWebhookTarget. */
export async function resolveWebhookCompanyId(
  provider: "meta" | "wasender" | "evolution",
  payload: unknown
): Promise<string> {
  const target = await resolveWebhookTarget(provider, payload);
  return target?.companyId ?? getDefaultCompanyId();
}
