import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia de segredos por empresa (tokens da API do WhatsApp).
 * AES-256-GCM com chave mestra em CREDENTIALS_ENCRYPTION_KEY (32 bytes
 * em base64). Formato do payload: "v1:<iv b64>:<tag b64>:<ct b64>".
 */

const VERSION = "v1";
const IV_BYTES = 12;

function getMasterKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY ausente — configure a chave de criptografia de credenciais."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY inválida — precisa ser 32 bytes em base64."
    );
  }
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Segredo criptografado em formato inválido.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getMasterKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function secretLast4(plain: string): string {
  return plain.slice(-4);
}

export function maskSecret(last4: string | null | undefined): string {
  return last4 ? `••••••••${last4}` : "••••••••";
}
