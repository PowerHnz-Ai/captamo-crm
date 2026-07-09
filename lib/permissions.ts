import { getEffectiveRole, type RoleContext } from "./roles";
import type { UserRole } from "./types";

export type Permission =
  | "dashboard.view"
  | "reports.view"
  | "reports.view_own"
  | "connections.view"
  | "connections.manage"
  | "team.view"
  | "team.view_online"
  | "team.manage_roles"
  | "origins.manage"
  | "lists.manage"
  | "contacts.read"
  | "contacts.write"
  | "contacts.import"
  | "conversations.read_content"
  | "conversations.monitor"
  | "conversations.reply"
  | "conversations.delete"
  | "templates.manage"
  | "campaigns.manage"
  | "funnel.read"
  | "funnel.write";

// Modelo enxuto (3 rótulos, 2 tiers):
//   member  = "Atendente"  → operacional restrito, escopado às próprias conversas.
//   leader  = "Supervisor" |
//   gerente = "Líder"      | mesmo poder (tier completo). Muda só o rótulo.
//   admin   = interno (impersonation da Captamo = poder total).
// A API oficial (Meta) NÃO é permissão de papel — é gateada por platform admin.
const FULL_TIER: Permission[] = [
  "dashboard.view",
  "reports.view",
  "connections.view",
  "connections.manage",
  "team.view",
  "team.view_online",
  "team.manage_roles",
  "origins.manage",
  "lists.manage",
  "contacts.read",
  "contacts.write",
  "contacts.import",
  "conversations.read_content",
  "conversations.monitor",
  "conversations.reply",
  "conversations.delete",
  "templates.manage",
  "campaigns.manage",
  "funnel.read",
  "funnel.write",
];

const MATRIX: Record<UserRole, Permission[]> = {
  admin: FULL_TIER,
  gerente: FULL_TIER, // Líder
  leader: FULL_TIER, // Supervisor
  member: [
    "dashboard.view",
    "reports.view_own",
    "contacts.read",
    "conversations.read_content",
    "conversations.reply",
    "funnel.read",
  ],
};

export function can(ctx: RoleContext, permission: Permission): boolean {
  const role = getEffectiveRole(ctx);
  return MATRIX[role].includes(permission);
}

export function canAny(ctx: RoleContext, permissions: Permission[]): boolean {
  return permissions.some((p) => can(ctx, p));
}

export function isAdminRole(ctx: RoleContext): boolean {
  return getEffectiveRole(ctx) === "admin";
}

export function canViewConnections(ctx: RoleContext): boolean {
  return can(ctx, "connections.view");
}

export function canManageConnections(ctx: RoleContext): boolean {
  return can(ctx, "connections.manage");
}

export function canViewTeam(ctx: RoleContext): boolean {
  return can(ctx, "team.view");
}

export function canViewOnlinePresence(ctx: RoleContext): boolean {
  return can(ctx, "team.view_online");
}

export function canManageTeamRoles(ctx: RoleContext): boolean {
  return can(ctx, "team.manage_roles");
}

/**
 * Teto de promoção: quem pode conceder qual papel.
 * - platform admin: qualquer papel.
 * - tier completo (Líder/Supervisor, e o admin interno): qualquer papel da
 *   clínica (Atendente/Supervisor/Líder), mas não o admin interno.
 * - Atendente: nenhum.
 */
export function canAssignRole(
  actor: RoleContext & { platformAdmin?: boolean },
  targetRole: UserRole
): boolean {
  if (actor.platformAdmin) return true;
  const actorRole = getEffectiveRole(actor);
  if (actorRole === "member") return false;
  return targetRole !== "admin";
}

/**
 * Tier completo (Líder/Supervisor) gerencia qualquer usuário da clínica, exceto
 * o admin interno. Atendente não gerencia ninguém. Platform admin sempre pode.
 */
export function canManageUser(
  actor: RoleContext & { platformAdmin?: boolean },
  target: RoleContext
): boolean {
  if (actor.platformAdmin) return true;
  const actorRole = getEffectiveRole(actor);
  if (actorRole === "member") return false;
  return getEffectiveRole(target) !== "admin";
}

export function canReadConversationContent(ctx: RoleContext): boolean {
  return can(ctx, "conversations.read_content");
}

export function canMonitorConversations(ctx: RoleContext): boolean {
  return can(ctx, "conversations.monitor");
}

export function canDeleteConversation(ctx: RoleContext): boolean {
  return can(ctx, "conversations.delete");
}

export function canManageCampaigns(ctx: RoleContext): boolean {
  return can(ctx, "campaigns.manage");
}

export function canManageTemplates(ctx: RoleContext): boolean {
  return can(ctx, "templates.manage");
}
