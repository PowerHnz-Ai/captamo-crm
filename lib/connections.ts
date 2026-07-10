import { getSql } from "./db";
import { connectionFromRow } from "./db-mappers";
import { decryptSecret } from "./crypto";
import type { Connection, ConnectionStatus } from "./types";
import type { ProviderType, WhatsAppConfig } from "./whatsapp/types";

/**
 * Resolve a API key por nome de env var (legado evolution/wasender).
 * Tokens Meta por empresa ficam criptografados no banco — sem fallback global.
 */
export function resolveConnectionApiKey(ref?: string): string | undefined {
  if (!ref) return undefined;
  return process.env[ref]?.trim() || undefined;
}

function defaultApiKeyRef(provider: ProviderType): string | undefined {
  if (provider === "wasender") return "WASENDER_API_KEY";
  if (provider === "evolution") return "EVOLUTION_API_KEY";
  // meta_cloud: credencial vem do apiKeySecret por empresa, não de env.
  return undefined;
}

function tryDecrypt(companyId: string, encrypted?: string | null): string | undefined {
  if (!encrypted) return undefined;
  try {
    return decryptSecret(encrypted);
  } catch (error) {
    console.error(
      `[connections] falha ao descriptografar credencial de ${companyId}:`,
      error
    );
    return undefined;
  }
}

/**
 * Config efetivo de uma conexão. Token: segredo da conexão → segredo da
 * empresa (company_settings) → env por apiKeyRef (legado). phoneNumberId e
 * wabaId: conexão → company_settings. Sem credencial global.
 */
export async function resolveConnectionConfig(
  connection: Connection
): Promise<WhatsAppConfig> {
  const sql = getSql();
  const [connSecret, settings] = await Promise.all([
    sql.connection.findUnique({
      where: { id: connection.id },
      select: { apiKeySecret: true },
    }),
    sql.companySettings.findUnique({
      where: { companyId: connection.companyId },
      select: { apiKeySecret: true, phoneNumberId: true, wabaId: true },
    }),
  ]);

  // O segredo em company_settings é o TOKEN META da empresa — só vale para
  // meta_cloud. Se cair como apikey de uma conexão Evolution/Wasender, o
  // servidor devolve 401 Unauthorized.
  const apiKey =
    tryDecrypt(connection.companyId, connSecret?.apiKeySecret) ||
    (connection.provider === "meta_cloud"
      ? tryDecrypt(connection.companyId, settings?.apiKeySecret)
      : undefined) ||
    resolveConnectionApiKey(connection.apiKeyRef);

  return {
    provider: connection.provider,
    companyId: connection.companyId,
    phoneNumberId: connection.phoneNumberId || settings?.phoneNumberId || undefined,
    wabaId: connection.wabaId || settings?.wabaId || undefined,
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
  const row = await getSql().connection.findFirst({
    where: { id: connectionId, companyId },
  });
  return row ? connectionFromRow(row) : null;
}

export async function listConnections(
  companyId: string
): Promise<Connection[]> {
  await ensureDefaultConnection(companyId);
  const rows = await getSql().connection.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(connectionFromRow);
}

export async function getDefaultConnection(
  companyId: string
): Promise<Connection | null> {
  const sql = getSql();
  const preferred = await sql.connection.findFirst({
    where: { companyId, isDefault: true },
  });
  if (preferred) return connectionFromRow(preferred);

  const first = await sql.connection.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  return first ? connectionFromRow(first) : null;
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
  const sql = getSql();
  const existing = await sql.connection.findFirst({
    where: { companyId },
    select: { id: true },
  });
  const isFirst = !existing;

  const row = await sql.connection.create({
    data: {
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
    },
  });
  return connectionFromRow(row);
}

export async function updateConnection(
  companyId: string,
  connectionId: string,
  patch: Partial<Omit<Connection, "id" | "companyId" | "createdAt">>
): Promise<void> {
  await getSql().connection.updateMany({
    where: { id: connectionId, companyId },
    data: {
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.instanceId !== undefined ? { instanceId: patch.instanceId } : {}),
      ...(patch.phoneNumber !== undefined ? { phoneNumber: patch.phoneNumber } : {}),
      ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
      ...(patch.apiKeyRef !== undefined ? { apiKeyRef: patch.apiKeyRef } : {}),
      ...(patch.phoneNumberId !== undefined
        ? { phoneNumberId: patch.phoneNumberId }
        : {}),
      ...(patch.wabaId !== undefined ? { wabaId: patch.wabaId } : {}),
      ...(patch.messagingLimitTier !== undefined
        ? { messagingLimitTier: patch.messagingLimitTier }
        : {}),
      ...(patch.dailyCap !== undefined ? { dailyCap: patch.dailyCap } : {}),
      ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
    },
  });
}

export async function deleteConnection(
  companyId: string,
  connectionId: string
): Promise<void> {
  await getSql().connection.deleteMany({
    where: { id: connectionId, companyId },
  });
}

/**
 * Cria uma conexão default a partir da config da empresa (company_settings)
 * caso a empresa ainda não possua nenhuma conexão.
 */
export async function ensureDefaultConnection(
  companyId: string
): Promise<void> {
  const sql = getSql();
  const existing = await sql.connection.findFirst({
    where: { companyId },
    select: { id: true },
  });
  if (existing) return;

  const settings = await sql.companySettings.findUnique({
    where: { companyId },
  });

  const provider: ProviderType =
    (settings?.provider as ProviderType | null) || "meta_cloud";
  const label =
    provider === "meta_cloud"
      ? "WhatsApp Principal"
      : provider === "wasender"
        ? "Wasender"
        : "Evolution";

  // Sem config da empresa (API ainda não ativada pela equipe), a conexão
  // nasce desconectada — o envio fica bloqueado até a ativação.
  const configured = Boolean(settings?.apiKeySecret || settings?.provider);

  await createConnection(companyId, {
    label,
    provider,
    instanceId: settings?.instanceId ?? undefined,
    baseUrl: settings?.baseUrl ?? undefined,
    apiKeyRef: settings?.apiKeyRef ?? defaultApiKeyRef(provider),
    phoneNumberId: settings?.phoneNumberId ?? undefined,
    wabaId: settings?.wabaId ?? undefined,
    status: configured ? "connected" : "disconnected",
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
  const row = await getSql().connection.findFirst({
    where: { companyId, instanceId },
  });
  return row ? connectionFromRow(row) : null;
}

/** Resolve a conexão Meta pelo phone_number_id (usado no webhook oficial). */
export async function resolveConnectionByPhoneNumberId(
  companyId: string,
  phoneNumberId: string
): Promise<Connection | null> {
  const row = await getSql().connection.findFirst({
    where: { companyId, phoneNumberId },
  });
  return row ? connectionFromRow(row) : null;
}
