import type { UserRole } from "./types";

// Modelo enxuto: 3 rótulos visíveis (gerente=Líder, leader=Supervisor,
// member=Atendente). "admin" é interno (impersonation da Captamo).
const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gerente: "Líder",
  leader: "Supervisor",
  member: "Atendente",
};

export function normalizeRole(role?: string | null, cargo?: string | null): UserRole {
  const normalizedRole = role ? normalizeSingleRole(role) : null;
  const normalizedCargo = cargo ? normalizeSingleRole(cargo) : null;

  // Durante migração: role padrão "member" não deve sobrescrever cargo legado elevado.
  if (role === "member" && normalizedCargo && normalizedCargo !== "member") {
    return normalizedCargo;
  }

  if (normalizedRole) return normalizedRole;
  if (normalizedCargo) return normalizedCargo;
  return "member";
}

/**
 * Tolerante a variações: docs de usuário podem vir de fontes legadas (Task
 * Checklist, console) com maiúsculas, acentos ou labels ("Líder", "Supervisor").
 * Um valor não reconhecido cai em member — o que já rebaixou um gerente real
 * silenciosamente; por isso aceitamos os sinônimos conhecidos.
 */
function normalizeSingleRole(raw: string): UserRole | null {
  const value = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (value === "admin" || value === "administrador") return "admin";
  if (value === "gerente" || value === "lider") return "gerente";
  if (value === "leader" || value === "supervisor") return "leader";
  if (value === "atendimento" || value === "atendente") return "member";
  if (value === "member" || value === "colaborador") return "member";
  return null;
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export interface RoleContext {
  role?: string | null;
  cargo?: string | null;
}

export function getEffectiveRole(ctx: RoleContext): UserRole {
  return normalizeRole(ctx.role, ctx.cargo);
}
