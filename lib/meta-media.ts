import { getWhatsAppConfig } from "./companies";
import { MetaCloudProvider } from "./whatsapp/meta-cloud-provider";

export function isMetaMediaId(value: string | undefined): boolean {
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  return /^\d{8,}$/.test(value.trim());
}

export async function fetchCompanyMetaMedia(
  companyId: string,
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const config = await getWhatsAppConfig(companyId);
  const provider = new MetaCloudProvider(config);
  return provider.downloadMetaMedia(mediaId);
}

export function normalizeAudioMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("ogg")) return "audio/ogg";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "audio/mpeg";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "audio/mp4";
  if (normalized.includes("aac")) return "audio/aac";
  if (normalized.includes("webm")) return "audio/webm";
  return mimeType;
}
