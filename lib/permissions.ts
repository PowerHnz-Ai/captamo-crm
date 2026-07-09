import { getEffectiveRole, type RoleContext } from "./roles";
import type { UserRole } from "./types";

export type Permission =
  | "hub.access"
  | "dashboard.view"
  | "reports.view"
  | "reports.view_own"
  | "integrations.view"
  | "integrations.manage"
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
  | "funnel.write"
  | "checklist.tasks_own"
  | "checklist.tasks_team"
  | "checklist.tasks_delete_any"
  | "checklist.team_panel"
  | "checklist.working_days";

const MATRIX: Record<UserRole, Permission[]> = {
  admin: [
    "hub.access",
    "dashboard.view",
    "reports.view",
    "integrations.view",
    "integrations.manage",
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
    "checklist.tasks_own",
    "checklist.tasks_team",
    "checklist.tasks_delete_any",
    "checklist.team_panel",
    "checklist.working_days",
  ],
  gerente: [
    "hub.access",
    "dashboard.view",
    "reports.view",
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
    "templates.manage",
    "campaigns.manage",
    "funnel.read",
    "funnel.write",
    "checklist.tasks_own",
    "checklist.tasks_team",
    "checklist.tasks_delete_any",
    "checklist.team_panel",
  ],
  leader: [
    "hub.access",
    "dashboard.view",
    "reports.view",
    "contacts.read",
    "contacts.write",
    "conversations.read_content",
    "conversations.monitor",
    "conversations.reply",
    "templates.manage",
    "campaigns.manage",
    "funnel.read",
    "funnel.write",
    "checklist.tasks_own",
    "checklist.tasks_team",
  ],
  member: [
    "hub.access",
    "dashboard.view",
    "reports.view_own",
    "contacts.read",
    "conversations.read_content",
    "conversations.reply",
    "funnel.read",
    "checklist.tasks_own",
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

export function canManageIntegrations(ctx: RoleContext): boolean {
  return can(ctx, "integrations.manage");
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
 * - admin (ou platform admin): qualquer papel, inclusive admin.
 * - gerente: até gerente (member | leader | gerente); nunca admin.
 * - demais papéis: nenhum.
 */
export function canAssignRole(
  actor: RoleContext & { platformAdmin?: boolean },
  targetRole: UserRole
): boolean {
  if (actor.platformAdmin) return true;
  const actorRole = getEffectiveRole(actor);
  if (actorRole === "admin") return true;
  if (actorRole === "gerente") return targetRole !== "admin";
  return false;
}

/**
 * Um gerente não pode editar/remover/redefinir senha de um admin (protege os
 * já criados). Admin e platform admin podem gerenciar qualquer usuário.
 */
export function canManageUser(
  actor: RoleContext & { platformAdmin?: boolean },
  target: RoleContext
): boolean {
  if (actor.platformAdmin) return true;
  const actorRole = getEffectiveRole(actor);
  if (actorRole === "admin") return true;
  if (actorRole === "gerente") return getEffectiveRole(target) !== "admin";
  return false;
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
