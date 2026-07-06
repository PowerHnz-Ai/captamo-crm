import { getSql } from "./db";
import { getEffectiveRole } from "./roles";
import type { PresenceRecord, PresenceStatus, PresenceSurface } from "./presence-shared";
import type { UserRole } from "./types";

export type { PresenceRecord, PresenceStatus, PresenceSurface } from "./presence-shared";
export { SURFACE_LABELS, presenceRoleLabel } from "./presence-shared";

const ONLINE_MS = 90_000;
const AWAY_MS = 5 * 60_000;

export function resolvePresenceStatus(lastSeenAt: Date): PresenceStatus {
  const age = Date.now() - lastSeenAt.getTime();
  if (age <= ONLINE_MS) return "online";
  if (age <= AWAY_MS) return "away";
  return "offline";
}

export async function upsertPresence(input: {
  companyId: string;
  uid: string;
  name?: string;
  email?: string;
  role?: string;
  cargo?: string;
  currentSurface: PresenceSurface;
  currentPath?: string;
  status?: PresenceStatus;
}): Promise<void> {
  const now = new Date();
  const role = getEffectiveRole({ role: input.role, cargo: input.cargo });

  await getSql().presence.upsert({
    where: {
      companyId_uid: { companyId: input.companyId, uid: input.uid },
    },
    create: {
      companyId: input.companyId,
      uid: input.uid,
      name: input.name || null,
      email: input.email || null,
      role,
      status: input.status || "online",
      currentSurface: input.currentSurface,
      currentPath: input.currentPath || null,
      lastSeenAt: now,
    },
    update: {
      name: input.name || null,
      email: input.email || null,
      role,
      status: input.status || "online",
      currentSurface: input.currentSurface,
      currentPath: input.currentPath || null,
      lastSeenAt: now,
    },
  });
}

export async function markPresenceOffline(companyId: string, uid: string): Promise<void> {
  await getSql().presence.updateMany({
    where: { companyId, uid },
    data: { status: "offline", lastSeenAt: new Date() },
  });
}

export async function listCompanyPresence(companyId: string): Promise<PresenceRecord[]> {
  const rows = await getSql().presence.findMany({ where: { companyId } });

  return rows
    .map((row) => {
      const lastSeenAt = row.lastSeenAt || new Date(0);
      const status = resolvePresenceStatus(lastSeenAt);

      return {
        uid: row.uid,
        name: row.name ?? undefined,
        email: row.email ?? undefined,
        role: (row.role as UserRole | null) || "member",
        status,
        currentSurface: (row.currentSurface as PresenceSurface) || "api",
        currentPath: row.currentPath ?? undefined,
        lastSeenAt,
        updatedAt: row.updatedAt || lastSeenAt,
      };
    })
    .filter((r) => r.status !== "offline")
    .sort((a, b) => {
      const order = { online: 0, away: 1, offline: 2 };
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return (a.name || a.email || "").localeCompare(b.name || b.email || "", "pt-BR");
    });
}
