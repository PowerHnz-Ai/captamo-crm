import { getSql } from "./db";
import { decryptSecret } from "./crypto";
import type { ProviderType, WhatsAppConfig } from "./whatsapp/types";

export interface CompanyWhatsAppDoc {
  provider?: ProviderType;
  phoneNumberId?: string;
  wabaId?: string;
  instanceId?: string;
  apiKeyRef?: string;
  webhookVerifyToken?: string;
  messagingLimitTier?: number;
  dailyCap?: number;
  baseUrl?: string;
}

/**
 * Resolve API key por nome de env var (legado evolution/wasender). O token
 * Meta por empresa fica criptografado em company_settings.apiKeySecret —
 * NÃO há mais fallback para credencial global.
 */
function resolveApiKey(ref?: string): string | undefined {
  if (!ref) return undefined;
  return process.env[ref]?.trim() || undefined;
}

/** Descriptografa o segredo por empresa; falha vira "não configurado". */
function decryptStoredSecret(
  companyId: string,
  encrypted?: string | null
): string | undefined {
  if (!encrypted) return undefined;
  try {
    return decryptSecret(encrypted);
  } catch (error) {
    console.error(`[companies] falha ao descriptografar credencial de ${companyId}:`, error);
    return undefined;
  }
}

export async function getWhatsAppConfig(
  companyId: string
): Promise<WhatsAppConfig> {
  const settings = await getSql().companySettings.findUnique({
    where: { companyId },
  });

  if (!settings?.provider) {
    // Empresa sem config: provider default sem credencial — o provider
    // recusa o envio com "WhatsApp não configurado".
    return { provider: "meta_cloud", companyId };
  }

  const token =
    decryptStoredSecret(companyId, settings.apiKeySecret) ||
    resolveApiKey(settings.apiKeyRef ?? undefined);

  return {
    provider: settings.provider as ProviderType,
    companyId,
    phoneNumberId: settings.phoneNumberId ?? undefined,
    wabaId: settings.wabaId ?? undefined,
    instanceId: settings.instanceId ?? undefined,
    apiKey: token,
    token,
    webhookVerifyToken:
      settings.webhookVerifyToken ||
      process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
    messagingLimitTier: settings.messagingLimitTier ?? 1,
    dailyCap: settings.dailyCap ?? Number(process.env.CRM_DAILY_CAP || "1000"),
    baseUrl:
      settings.baseUrl ||
      process.env.EVOLUTION_API_BASE_URL?.trim() ||
      process.env.WASENDER_API_BASE_URL?.trim(),
  };
}

export async function updateCompanyWhatsAppConfig(
  companyId: string,
  config: Partial<CompanyWhatsAppDoc>
): Promise<void> {
  const data = {
    ...(config.provider !== undefined ? { provider: config.provider } : {}),
    ...(config.phoneNumberId !== undefined
      ? { phoneNumberId: config.phoneNumberId }
      : {}),
    ...(config.wabaId !== undefined ? { wabaId: config.wabaId } : {}),
    ...(config.instanceId !== undefined ? { instanceId: config.instanceId } : {}),
    ...(config.apiKeyRef !== undefined ? { apiKeyRef: config.apiKeyRef } : {}),
    ...(config.webhookVerifyToken !== undefined
      ? { webhookVerifyToken: config.webhookVerifyToken }
      : {}),
    ...(config.messagingLimitTier !== undefined
      ? { messagingLimitTier: config.messagingLimitTier }
      : {}),
    ...(config.dailyCap !== undefined ? { dailyCap: config.dailyCap } : {}),
    ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
  };

  await getSql().companySettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
}

export async function resolveCompanyByPhoneNumberId(
  phoneNumberId: string
): Promise<string | null> {
  const row = await getSql().companySettings.findFirst({
    where: { phoneNumberId },
    select: { companyId: true },
  });
  // Sem fallback por env: o roteamento inbound é exclusivamente pelo
  // phoneNumberId cadastrado em company_settings (isolamento por clínica).
  return row?.companyId ?? null;
}

export async function resolveCompanyByInstanceId(
  instanceId: string
): Promise<string | null> {
  const row = await getSql().companySettings.findFirst({
    where: { instanceId },
    select: { companyId: true },
  });
  if (row) return row.companyId;

  const defaultId = process.env.CRM_DEFAULT_COMPANY_ID?.trim();
  const envInstance = process.env.EVOLUTION_INSTANCE_ID?.trim();
  if (defaultId && envInstance === instanceId) {
    return defaultId;
  }

  return null;
}

export async function resolveCompanyByWasenderSession(
  sessionId: string
): Promise<string | null> {
  const row = await getSql().companySettings.findFirst({
    where: { instanceId: sessionId },
    select: { companyId: true },
  });
  if (row) return row.companyId;

  const defaultId = process.env.CRM_DEFAULT_COMPANY_ID?.trim();
  const envSession = process.env.WASENDER_SESSION_ID?.trim();
  if (defaultId && envSession === sessionId) {
    return defaultId;
  }

  return null;
}

export function extractMetaPhoneNumberId(payload: unknown): string | null {
  const data = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: { metadata?: { phone_number_id?: string } };
      }>;
    }>;
  };

  for (const entry of data.entry || []) {
    for (const change of entry.changes || []) {
      const id = change.value?.metadata?.phone_number_id;
      if (id) return id;
    }
  }
  return null;
}
