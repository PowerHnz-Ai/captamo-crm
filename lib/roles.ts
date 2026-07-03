import type { UserRole } from "./types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  leader: "Líder",
  member: "Colaborador",
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

function normalizeSingleRole(raw: string): UserRole | null {
  if (raw === "admin") return "admin";
  if (raw === "gerente") return "gerente";
  if (raw === "leader") return "leader";
  if (raw === "atendimento") return "member";
  if (raw === "member") return "member";
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
