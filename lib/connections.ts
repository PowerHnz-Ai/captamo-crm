import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { CompanyWhatsAppDoc } from "./companies";
import type { Connection, ConnectionStatus } from "./types";
import type { ProviderType, WhatsAppConfig } from "./whatsapp/types";

function connectionsCollection(companyId: string) {
  return getDb().collection("companies").doc(companyId).collection("connections");
}

/** Resolve a API key a partir do nome da env var guardado em apiKeyRef. */
export function resolveConnectionApiKey(ref?: string): string | undefined {
  if (!ref) return undefined;
  const envKey = process.env[ref];
  if (envKey) return envKey.trim();
  if (ref === "META_WHATSAPP_TOKEN") return process.env.META_WHATSAPP_TOKEN?.trim();
  if (ref === "WASENDER_API_KEY") return process.env.WASENDER_API_KEY?.trim();
  if (ref === "EVOLUTION_API_KEY") return process.env.EVOLUTION_API_KEY?.trim();
  return ref;
}

function defaultApiKeyRef(provider: ProviderType): string {
  if (provider === "wasender") return "WASENDER_API_KEY";
  if (provider === "evolution") return "EVOLUTION_API_KEY";
  return "META_WHATSAPP_TOKEN";
}

export function connectionToWhatsAppConfig(connection: Connection): WhatsAppConfig {
  const apiKey = resolveConnectionApiKey(connection.apiKeyRef);
  return {
    provider: connection.provider,
    companyId: connection.companyId,
    phoneNumberId:
      connection.phoneNumberId || process.env.META_PHONE_NUMBER_ID?.trim(),
    wabaId: connection.wabaId || process.env.META_WABA_ID?.trim(),
    instanceId: connection.instanceId,
    apiKey,
    token: apiKey,
    webhookVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
    messagingLimitTier: connection.messagingLimitTier ?? 1,
    dailyCap:
      connection.dailyCap ?? Number(process.env.CRM_DAILY_CAP || "1000"),
    baseUrl:
      connection.baseUrl ||
      (connection.provider === "evolution"
        ? process.env.EVOLUTION_API_BASE_URL?.trim()
        : connection.provider === "wasender"
          ? process.env.WASENDER_API_BASE_URL?.trim()
          : undefined),
  };
}

export async function getConnection(
  companyId: string,
  connectionId: string
): Promise<Connection | null> {
  const doc = await connectionsCollection(companyId).doc(connectionId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Connection;
}

export async function listConnections(
  companyId: string
): Promise<Connection[]> {
  await ensureDefaultConnection(companyId);
  const snap = await connectionsCollection(companyId).orderBy("createdAt", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Connection);
}

export async function getDefaultConnection(
  companyId: string
): Promise<Connection | null> {
  const snap = await connectionsCollection(companyId)
    .where("isDefault", "==", true)
    .limit(1)
    .get();
  if (!snap.empty) {
    const d = snap.docs[0]!;
    return { id: d.id, ...d.data() } as Connection;
  }
  const all = await connectionsCollection(companyId)
    .orderBy("createdAt", "asc")
    .limit(1)
    .get();
  if (!all.empty) {
    const d = all.docs[0]!;
    return { id: d.id, ...d.data() } as Connection;
  }
  return null;
}

export interface CreateConnectionInput {
  label: string;
  provider: ProviderType;
  instanceId?: string;
  baseUrl?: string;
  apiKeyRef?: string;
  phoneNumberId?: string;
  wabaId?: string;
  status?: ConnectionStatus;
  isDefault?: boolean;
}

export async function createConnection(
  companyId: string,
  input: CreateConnectionInput
): Promise<Connection> {
  const ts = Timestamp.now();
  const ref = connectionsCollection(companyId).doc();
  const existing = await connectionsCollection(companyId).limit(1).get();
  const isFirst = existing.empty;

  const connection: Omit<Connection, "id"> = {
    companyId,
    label: input.label,
    provider: input.provider,
    status: input.status || "disconnected",
    instanceId: input.instanceId,
    baseUrl: input.baseUrl,
    apiKeyRef: input.apiKeyRef || defaultApiKeyRef(input.provider),
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId,
    isDefault: input.isDefault ?? isFirst,
    createdAt: ts,
    updatedAt: ts,
  };

  await ref.set({ id: ref.id, ...connection });
  return { id: ref.id, ...connection };
}

export async function updateConnection(
  companyId: string,
  connectionId: string,
  patch: Partial<Omit<Connection, "id" | "companyId" | "createdAt">>
): Promise<void> {
  await connectionsCollection(companyId)
    .doc(connectionId)
    .set({ ...patch, updatedAt: Timestamp.now() }, { merge: true });
}

export async function deleteConnection(
  companyId: string,
  connectionId: string
): Promise<void> {
  await connectionsCollection(companyId).doc(connectionId).delete();
}

/**
 * Cria uma conexão default a partir da config legada companies/{id}.whatsapp
 * caso a empresa ainda não possua nenhuma conexão.
 */
export async function ensureDefaultConnection(
  companyId: string
): Promise<void> {
  const existing = await connectionsCollection(companyId).limit(1).get();
  if (!existing.empty) return;

  const companyDoc = await getDb().collection("companies").doc(companyId).get();
  const whatsapp = companyDoc.data()?.whatsapp as CompanyWhatsAppDoc | undefined;

  const provider: ProviderType = whatsapp?.provider || "meta_cloud";
  const label =
    provider === "meta_cloud"
      ? "WhatsApp Principal"
      : provider === "wasender"
        ? "Wasender"
        : "Evolution";

  await createConnection(companyId, {
    label,
    provider,
    instanceId: whatsapp?.instanceId,
    baseUrl: whatsapp?.baseUrl,
    apiKeyRef: whatsapp?.apiKeyRef || defaultApiKeyRef(provider),
    phoneNumberId: whatsapp?.phoneNumberId,
    wabaId: whatsapp?.wabaId,
    status: "connected",
    isDefault: true,
  });
}

/**
 * Provider efetivo de uma conversa: usa a conexão escolhida, senão a default,
 * senão a config legada da empresa (retrocompatibilidade).
 */
export async function getConnectionProvider(
  companyId: string,
  connectionId?: string
): Promise<ProviderType> {
  if (connectionId) {
    const connection = await getConnection(companyId, connectionId);
    if (connection) return connection.provider;
  }
  const def = await getDefaultConnection(companyId);
  if (def) return def.provider;
  const { getWhatsAppConfig } = await import("./companies");
  return (await getWhatsAppConfig(companyId)).provider;
}

/** Resolve a conexão por instanceId/session (usado no webhook). */
export async function resolveConnectionByInstanceId(
  companyId: string,
  instanceId: string
): Promise<Connection | null> {
  const snap = await connectionsCollection(companyId)
    .where("instanceId", "==", instanceId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as Connection;
}
