import type { Contact } from "./types";

export function templateHasImageHeader(
  header?: { type?: string } | null
): boolean {
  return header?.type === "IMAGE";
}

export function countTemplateVariables(body: string): number {
  const matches = body.match(/\{\{(\d+)\}\}/g) || [];
  const indexes = new Set(
    matches.map((token) => Number(token.replace(/\D/g, ""))).filter(Number.isFinite)
  );
  return indexes.size;
}

export function countTemplateVariablesInParts(parts: string[]): number {
  const indexes = new Set<number>();
  for (const part of parts) {
    const matches = part.match(/\{\{(\d+)\}\}/g) || [];
    for (const token of matches) {
      const n = Number(token.replace(/\D/g, ""));
      if (Number.isFinite(n)) indexes.add(n);
    }
  }
  return indexes.size;
}

/** Primeira palavra do nome (ex.: "João Silva" → "João"). */
export function extractContactFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] || trimmed;
}

export function resolveCampaignParameter(
  contact: Contact,
  mapping: string
): string {
  if (mapping === "first_name" || mapping === "name") {
    return extractContactFirstName(contact.name);
  }
  if (mapping === "phone") return contact.phone;
  if (mapping === "literal_today") {
    return new Date().toLocaleDateString("pt-BR");
  }
  if (mapping.startsWith("literal:")) return mapping.slice("literal:".length);
  if (mapping.startsWith("column:")) {
    const key = mapping.slice("column:".length);
    return contact.customFields?.[key] ?? "";
  }
  if (mapping.startsWith("origin:")) {
    const key = mapping.slice("origin:".length);
    return contact.originFields?.[key] ?? "";
  }
  const custom = contact.customFields?.[mapping];
  if (custom) return custom;
  return "";
}

export function buildCampaignParameters(
  contact: Contact,
  mapping: string[]
): string[] {
  return mapping.map((key) => resolveCampaignParameter(contact, key));
}

export function renderTemplateBody(body: string, parameters: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const idx = Number(n) - 1;
    return parameters[idx] ?? `{{${n}}}`;
  });
}

export function formatParameterMappingLabel(
  mapping: string,
  originFieldLabels?: Record<string, string>
): string {
  if (mapping === "first_name" || mapping === "name") return "Primeiro nome";
  if (mapping === "phone") return "Telefone";
  if (mapping === "literal_today") return "Data de hoje";
  if (mapping.startsWith("literal:")) return `Texto fixo: ${mapping.slice("literal:".length)}`;
  if (mapping.startsWith("column:")) return `Coluna: ${mapping.slice("column:".length)}`;
  if (mapping.startsWith("origin:")) {
    const key = mapping.slice("origin:".length);
    return originFieldLabels?.[key]
      ? `Campo de origem: ${originFieldLabels[key]}`
      : `Campo de origem: ${key}`;
  }
  return mapping;
}

export function buildPreviewContact(
  sample: {
    name: string;
    phone: string;
    customFields?: Record<string, string>;
    originFields?: Record<string, string>;
    originId?: string;
  }
): Contact {
  return {
    id: "preview",
    name: sample.name,
    phone: sample.phone,
    source: "preview",
    tags: [],
    optIn: true,
    blocked: false,
    customFields: sample.customFields,
    originFields: sample.originFields,
    originId: sample.originId,
    createdAt: {} as Contact["createdAt"],
    updatedAt: {} as Contact["updatedAt"],
  };
}
