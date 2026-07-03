import type { Template } from "./types";
import { countTemplateVariables } from "./campaign-params";

export function countVariablesInText(text: string): number {
  const matches = text.match(/\{\{(\d+)\}\}/g) || [];
  const indexes = new Set(
    matches.map((token) => Number(token.replace(/\D/g, ""))).filter(Number.isFinite)
  );
  return indexes.size;
}

export function getTemplateVariableCounts(template: Pick<Template, "body" | "header">) {
  const body = countTemplateVariables(template.body);
  const header =
    template.header?.type === "TEXT" && template.header.text
      ? countVariablesInText(template.header.text)
      : 0;
  return { body, header, total: body + header };
}

export function validateApprovedTemplate(template: Template | null, templateName: string) {
  if (!template) {
    return { ok: false as const, error: `Template "${templateName}" não encontrado.` };
  }
  if (template.status !== "approved") {
    return {
      ok: false as const,
      error: `Template "${templateName}" precisa estar aprovado pela Meta (status: ${template.status}).`,
    };
  }
  return { ok: true as const, template };
}

export function validateCampaignParameterMapping(
  template: Template,
  mapping: string[]
): { ok: true } | { ok: false; error: string } {
  const counts = getTemplateVariableCounts(template);
  if (counts.total === 0) {
    return mapping.length === 0 ? { ok: true } : { ok: false, error: "Template sem variáveis." };
  }
  if (mapping.length !== counts.body) {
    return {
      ok: false,
      error: `O corpo do template exige ${counts.body} variável(is), mas foram configuradas ${mapping.length}.`,
    };
  }
  return { ok: true };
}
