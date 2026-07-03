import type { Template } from "./types";

export function templateStatusLabel(status: Template["status"]): string {
  const map: Record<Template["status"], string> = {
    draft: "Novo template",
    pending: "Aguardando aprovação",
    submitted: "Aguardando aprovação",
    approved: "Aprovado",
    rejected: "Rejeitado",
  };
  return map[status] || status;
}

export function templateCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    MARKETING: "Marketing",
    UTILITY: "Utilidade",
    AUTHENTICATION: "Autenticação",
  };
  return map[category] || category;
}
