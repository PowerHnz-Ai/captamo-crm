import { getSql } from "./db";
import { encryptSecret, maskSecret, secretLast4 } from "./crypto";

/**
 * Configuração da API oficial do WhatsApp por clínica — feita exclusivamente
 * pela equipe da plataforma (platform admin). O token fica criptografado em
 * company_settings (fonte de verdade) e espelhado na conexão default
 * meta_cloud da empresa. O phoneNumberId em company_settings é o que roteia
 * o webhook inbound para a empresa certa.
 */

export interface WhatsappConfigStatus {
  configured: boolean;
  provider?: string;
  phoneNumberId?: string;
  wabaId?: string;
  tokenMasked: string;
  configuredAt?: number;
}

export class WhatsappConfigError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "WhatsappConfigError";
  }
}

export async function getWhatsappConfigStatus(
  companyId: string
): Promise<WhatsappConfigStatus> {
  const settings = await getSql().companySettings.findUnique({
    where: { companyId },
    select: {
      provider: true,
      phoneNumberId: true,
      wabaId: true,
      apiKeySecret: true,
      apiKeyLast4: true,
      configuredAt: true,
    },
  });

  const configured = Boolean(settings?.apiKeySecret);
  return {
    configured,
    provider: settings?.provider ?? undefined,
    phoneNumberId: settings?.phoneNumberId ?? undefined,
    wabaId: settings?.wabaId ?? undefined,
    tokenMasked: configured ? maskSecret(settings?.apiKeyLast4) : "",
    configuredAt: settings?.configuredAt?.getTime(),
  };
}

/** Valida token + phoneNumberId na Graph API (best-effort; rede fora não bloqueia). */
async function validateAgainstMeta(
  token: string,
  phoneNumberId: string
): Promise<void> {
  const version = process.env.META_GRAPH_API_VERSION || "v25.0";
  let res: Response;
  try {
    res = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    console.warn("[platform-whatsapp] validação na Meta indisponível:", error);
    return;
  }
  if (!res.ok) {
    throw new WhatsappConfigError(
      "A Meta rejeitou as credenciais (token ou ID do número inválidos). Verifique os dados e tente novamente.",
      422
    );
  }
}

export async function configureClientWhatsapp(
  companyId: string,
  input: { token: string; phoneNumberId: string; wabaId: string },
  configuredBy: string
): Promise<WhatsappConfigStatus> {
  const sql = getSql();

  // Um número só pode pertencer a uma empresa (roteamento do webhook).
  const conflict = await sql.companySettings.findFirst({
    where: { phoneNumberId: input.phoneNumberId, NOT: { companyId } },
    select: { companyId: true },
  });
  if (conflict) {
    throw new WhatsappConfigError(
      `Este ID de número já está em uso pela empresa ${conflict.companyId}.`,
      409
    );
  }

  await validateAgainstMeta(input.token, input.phoneNumberId);

  const apiKeySecret = encryptSecret(input.token);
  const apiKeyLast4 = secretLast4(input.token);
  const now = new Date();

  const data = {
    provider: "meta_cloud",
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId,
    apiKeySecret,
    apiKeyLast4,
    configuredAt: now,
    configuredBy,
  };
  await sql.companySettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });

  // Espelha na conexão default meta_cloud (cria se a empresa não tem nenhuma).
  const connection =
    (await sql.connection.findFirst({
      where: { companyId, provider: "meta_cloud", isDefault: true },
    })) ||
    (await sql.connection.findFirst({
      where: { companyId, provider: "meta_cloud" },
    }));

  const connectionData = {
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId,
    apiKeySecret,
    status: "connected",
  };
  if (connection) {
    await sql.connection.update({
      where: { id: connection.id },
      data: connectionData,
    });
  } else {
    const hasAny = await sql.connection.findFirst({
      where: { companyId },
      select: { id: true },
    });
    await sql.connection.create({
      data: {
        companyId,
        label: "WhatsApp Principal",
        provider: "meta_cloud",
        isDefault: !hasAny,
        ...connectionData,
      },
    });
  }

  return getWhatsappConfigStatus(companyId);
}
