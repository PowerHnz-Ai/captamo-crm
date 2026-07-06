// Seed mínimo pós-migração: garante company_settings + conexão default da
// empresa padrão (3VEGUT). Idempotente — roda em todo deploy.
//
// A partir da migração de credenciais por empresa:
// - preenche apenas campos AUSENTES (a tela do platform admin é a fonte de
//   verdade depois da primeira configuração);
// - se META_WHATSAPP_TOKEN existir no env e a empresa ainda não tiver
//   apiKeySecret, migra o token para o banco criptografado (AES-256-GCM
//   com CREDENTIALS_ENCRYPTION_KEY).
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { createCipheriv, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.production", ".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const companyId = process.env.CRM_DEFAULT_COMPANY_ID?.trim();
if (!companyId) {
  console.log("[seed] CRM_DEFAULT_COMPANY_ID não definido — nada a fazer.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("[seed] DATABASE_URL não definido.");
  process.exit(1);
}

// Mesmo formato de lib/crypto.ts: "v1:<iv b64>:<tag b64>:<ct b64>".
function encryptSecret(plain) {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    console.warn("[seed] CREDENTIALS_ENCRYPTION_KEY inválida (não são 32 bytes base64).");
    return null;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

const envPhoneNumberId = process.env.META_PHONE_NUMBER_ID?.trim() || null;
const envWabaId = process.env.META_WABA_ID?.trim() || null;
const envToken = process.env.META_WHATSAPP_TOKEN?.trim() || null;

const existing = await prisma.companySettings.findUnique({ where: { companyId } });

// Só preenche o que está ausente — nunca sobrescreve config feita pela tela.
const update = {};
if (!existing?.provider) update.provider = "meta_cloud";
if (!existing?.phoneNumberId && envPhoneNumberId) update.phoneNumberId = envPhoneNumberId;
if (!existing?.wabaId && envWabaId) update.wabaId = envWabaId;
if (!existing?.webhookVerifyToken && process.env.WHATSAPP_VERIFY_TOKEN) {
  update.webhookVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN.trim();
}
if (existing?.dailyCap == null) {
  update.dailyCap = Number(process.env.CRM_DAILY_CAP || "1000");
}

let encryptedToken = null;
if (!existing?.apiKeySecret && envToken) {
  encryptedToken = encryptSecret(envToken);
  if (encryptedToken) {
    update.apiKeySecret = encryptedToken;
    update.apiKeyLast4 = envToken.slice(-4);
    update.configuredAt = new Date();
    update.configuredBy = "seed";
    console.log("[seed] token do env migrado (criptografado) para company_settings.");
  } else {
    console.warn(
      "[seed] AVISO: META_WHATSAPP_TOKEN presente mas CREDENTIALS_ENCRYPTION_KEY ausente — token NÃO migrado; envio ficará bloqueado."
    );
  }
}

const settings = await prisma.companySettings.upsert({
  where: { companyId },
  create: { companyId, ...update },
  update,
});
console.log("[seed] company_settings ok:", settings.companyId);

// Conexão default: cria se não existir; espelha credencial se estiver vazia.
const conn = await prisma.connection.findFirst({
  where: { companyId },
  orderBy: { createdAt: "asc" },
});
if (!conn) {
  const created = await prisma.connection.create({
    data: {
      companyId,
      label: "WhatsApp Principal",
      provider: "meta_cloud",
      status: settings.apiKeySecret ? "connected" : "disconnected",
      phoneNumberId: settings.phoneNumberId,
      wabaId: settings.wabaId,
      apiKeySecret: settings.apiKeySecret,
      isDefault: true,
    },
  });
  console.log("[seed] conexão default criada:", created.id);
} else if (!conn.apiKeySecret && settings.apiKeySecret) {
  await prisma.connection.update({
    where: { id: conn.id },
    data: {
      apiKeySecret: settings.apiKeySecret,
      phoneNumberId: conn.phoneNumberId || settings.phoneNumberId,
      wabaId: conn.wabaId || settings.wabaId,
      status: "connected",
    },
  });
  console.log("[seed] credencial espelhada na conexão default:", conn.id);
} else {
  console.log("[seed] conexão já existe — mantida.");
}

await prisma.$disconnect();
