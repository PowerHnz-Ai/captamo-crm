import type { Contact } from "./types";
import type { CompanyScope } from "./firestore-repositories";
import { resolveCampaignParameter } from "./campaign-params";

function looksLikeFirestoreId(value: string): boolean {
  return /^[a-zA-Z0-9]{18,28}$/.test(value);
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10;
}

async function resolveContactRefValue(
  raw: string,
  scope: CompanyScope
): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const { getContactById, findContactByPhone } = await import("./firestore-repositories");

  if (looksLikeFirestoreId(trimmed)) {
    const byId = await getContactById(trimmed, scope);
    if (byId?.name) return byId.name;
  }

  if (looksLikePhone(trimmed)) {
    try {
      const byPhone = await findContactByPhone(trimmed, scope);
      if (byPhone?.name) return byPhone.name;
    } catch {
      // usa texto bruto
    }
  }

  return trimmed;
}

export async function resolveCampaignParameterAsync(
  contact: Contact,
  mapping: string,
  scope: CompanyScope,
  contactRefFieldKeys?: Set<string>
): Promise<string> {
  if (mapping.startsWith("origin:")) {
    const key = mapping.slice("origin:".length);
    const raw = contact.originFields?.[key] ?? "";
    if (raw && contactRefFieldKeys?.has(key)) {
      return resolveContactRefValue(raw, scope);
    }
    return raw;
  }
  return resolveCampaignParameter(contact, mapping);
}

export async function buildCampaignParametersAsync(
  contact: Contact,
  mapping: string[],
  scope: CompanyScope,
  contactRefFieldKeys?: Set<string>
): Promise<string[]> {
  const results: string[] = [];
  for (const key of mapping) {
    results.push(
      await resolveCampaignParameterAsync(contact, key, scope, contactRefFieldKeys)
    );
  }
  return results;
}
