import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getEffectiveRole } from "./roles";
import type { PresenceRecord, PresenceStatus, PresenceSurface } from "./presence-shared";

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

function presenceRef(companyId: string, uid: string) {
  return getDb()
    .collection("company_presence")
    .doc(companyId)
    .collection("users")
    .doc(uid);
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
  const now = Timestamp.now();
  const role = getEffectiveRole({ role: input.role, cargo: input.cargo });

  await presenceRef(input.companyId, input.uid).set(
    {
      uid: input.uid,
      name: input.name || null,
      email: input.email || null,
      role,
      status: input.status || "online",
      currentSurface: input.currentSurface,
      currentPath: input.currentPath || null,
      lastSeenAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function markPresenceOffline(companyId: string, uid: string): Promise<void> {
  const now = Timestamp.now();
  await presenceRef(companyId, uid).set(
    {
      status: "offline",
      lastSeenAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function listCompanyPresence(companyId: string): Promise<PresenceRecord[]> {
  const snap = await getDb()
    .collection("company_presence")
    .doc(companyId)
    .collection("users")
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() as {
        uid?: string;
        name?: string;
        email?: string;
        role?: import("./types").UserRole;
        currentSurface?: PresenceSurface;
        currentPath?: string;
        lastSeenAt?: Timestamp;
        updatedAt?: Timestamp;
      };

      const lastSeenAt = data.lastSeenAt?.toDate() || new Date(0);
      const status = resolvePresenceStatus(lastSeenAt);

      return {
        uid: data.uid || doc.id,
        name: data.name,
        email: data.email,
        role: data.role || "member",
        status,
        currentSurface: data.currentSurface || "api",
        currentPath: data.currentPath,
        lastSeenAt,
        updatedAt: data.updatedAt?.toDate() || lastSeenAt,
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
