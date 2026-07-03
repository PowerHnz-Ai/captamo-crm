import { getDb } from "./firebase-admin";
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

function envFallbackConfig(companyId: string): WhatsAppConfig {
  return {
    provider: "meta_cloud",
    companyId,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID?.trim(),
    wabaId: process.env.META_WABA_ID?.trim(),
    token: process.env.META_WHATSAPP_TOKEN?.trim(),
    webhookVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
    messagingLimitTier: 1,
    dailyCap: Number(process.env.CRM_DAILY_CAP || "1000"),
  };
}

function resolveApiKey(ref?: string): string | undefined {
  if (!ref) return undefined;
  const envKey = process.env[ref];
  if (envKey) return envKey;
  if (ref === "META_WHATSAPP_TOKEN") {
    return process.env.META_WHATSAPP_TOKEN?.trim();
  }
  if (ref === "WASENDER_API_KEY") {
    return process.env.WASENDER_API_KEY?.trim();
  }
  if (ref === "EVOLUTION_API_KEY") {
    return process.env.EVOLUTION_API_KEY?.trim();
  }
  return ref;
}

export async function getWhatsAppConfig(
  companyId: string
): Promise<WhatsAppConfig> {
  const doc = await getDb().collection("companies").doc(companyId).get();
  const whatsapp = doc.data()?.whatsapp as CompanyWhatsAppDoc | undefined;

  if (!whatsapp?.provider) {
    return envFallbackConfig(companyId);
  }

  const token =
    resolveApiKey(whatsapp.apiKeyRef) ||
    (whatsapp.provider === "meta_cloud"
      ? process.env.META_WHATSAPP_TOKEN?.trim()
      : undefined);

  return {
    provider: whatsapp.provider,
    companyId,
    phoneNumberId:
      whatsapp.phoneNumberId || process.env.META_PHONE_NUMBER_ID?.trim(),
    wabaId: whatsapp.wabaId || process.env.META_WABA_ID?.trim(),
    instanceId: whatsapp.instanceId,
    apiKey: token,
    token,
    webhookVerifyToken:
      whatsapp.webhookVerifyToken ||
      process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
    messagingLimitTier: whatsapp.messagingLimitTier ?? 1,
    dailyCap: whatsapp.dailyCap ?? Number(process.env.CRM_DAILY_CAP || "1000"),
    baseUrl:
      whatsapp.baseUrl ||
      process.env.EVOLUTION_API_BASE_URL?.trim() ||
      process.env.WASENDER_API_BASE_URL?.trim(),
  };
}

export async function updateCompanyWhatsAppConfig(
  companyId: string,
  config: Partial<CompanyWhatsAppDoc>
): Promise<void> {
  await getDb()
    .collection("companies")
    .doc(companyId)
    .set({ whatsapp: config }, { merge: true });
}

export async function resolveCompanyByPhoneNumberId(
  phoneNumberId: string
): Promise<string | null> {
  const snap = await getDb()
    .collection("companies")
    .where("whatsapp.phoneNumberId", "==", phoneNumberId)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0]!.id;
  }

  const defaultId = process.env.CRM_DEFAULT_COMPANY_ID?.trim();
  const envPhoneId = process.env.META_PHONE_NUMBER_ID?.trim();
  if (defaultId && envPhoneId === phoneNumberId) {
    return defaultId;
  }

  return null;
}

export async function resolveCompanyByInstanceId(
  instanceId: string
): Promise<string | null> {
  const snap = await getDb()
    .collection("companies")
    .where("whatsapp.instanceId", "==", instanceId)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0]!.id;
  }

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
  const snap = await getDb()
    .collection("companies")
    .where("whatsapp.instanceId", "==", sessionId)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0]!.id;
  }

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
