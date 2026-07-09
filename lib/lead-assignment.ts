import { Timestamp, FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";
import { getAssignmentSettings, setLastRoundRobinUid } from "./assignment-settings";
import { getDb } from "./firebase-admin";
import { getSql } from "./db";
import type { CompanyScope } from "./firestore-repositories";
import { getConversationById } from "./firestore-repositories";
import { getEffectiveRole, normalizeRole } from "./roles";
import { isUserActive, userDisplayName } from "./user-profiles";
import type { TeamUser, UserRole } from "./types";

export type { TeamUser };

// Usuários continuam no Firestore (compartilhados com Auth e o Task Checklist);
// conversas vivem no MariaDB.
function mapTeamUserDoc(doc: DocumentSnapshot): TeamUser {
  const data = doc.data() as Omit<TeamUser, "photoUpdatedAt"> & {
    companyId?: string;
    photoUpdatedAt?: { toMillis?: () => number };
  };
  const role = getEffectiveRole(data);
  return {
    ...data,
    uid: doc.id,
    role,
    photoUpdatedAt: data.photoUpdatedAt?.toMillis?.(),
  };
}

export async function listAttendants(scope: CompanyScope): Promise<TeamUser[]> {
  const snap = await getDb()
    .collection("users")
    .where("companyId", "==", scope.companyId)
    .get();

  return snap.docs
    .map(mapTeamUserDoc)
    .filter((u) => isUserActive(u))
    .filter((u) => getEffectiveRole(u) === "member");
}

export async function listTeamUsers(scope: CompanyScope): Promise<TeamUser[]> {
  const snap = await getDb()
    .collection("users")
    .where("companyId", "==", scope.companyId)
    .get();

  return snap.docs.map(mapTeamUserDoc).filter((u) => isUserActive(u));
}

export async function getTeamUser(
  uid: string,
  scope: CompanyScope
): Promise<TeamUser | null> {
  const doc = await getDb().collection("users").doc(uid).get();
  if (!doc.exists) return null;
  const user = mapTeamUserDoc(doc);
  const data = doc.data() as { companyId?: string };
  if (data.companyId !== scope.companyId) return null;
  return user;
}

export async function updateUserProfile(
  uid: string,
  patch: { name?: string; username?: string | null; jobTitle?: string | null },
  scope: CompanyScope
): Promise<TeamUser> {
  const doc = await getDb().collection("users").doc(uid).get();
  if (!doc.exists) throw new Error("Usuário não encontrado.");
  const data = doc.data() as { companyId?: string };
  if (data.companyId !== scope.companyId) throw new Error("Usuário de outra empresa.");

  const update: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.username !== undefined) {
    if (patch.username === null || patch.username.trim() === "") {
      update.username = FieldValue.delete();
    } else {
      update.username = patch.username.trim();
    }
  }
  if (patch.jobTitle !== undefined) {
    if (patch.jobTitle === null || patch.jobTitle.trim() === "") {
      update.jobTitle = FieldValue.delete();
    } else {
      update.jobTitle = patch.jobTitle.trim();
    }
  }

  await doc.ref.update(update);
  const updated = await getTeamUser(uid, scope);
  if (!updated) throw new Error("Usuário não encontrado.");
  return updated;
}

export async function setUserAvatarPath(
  uid: string,
  photoStoragePath: string,
  scope: CompanyScope
): Promise<void> {
  const doc = await getDb().collection("users").doc(uid).get();
  if (!doc.exists) throw new Error("Usuário não encontrado.");
  const data = doc.data() as { companyId?: string };
  if (data.companyId !== scope.companyId) throw new Error("Usuário de outra empresa.");

  await doc.ref.update({
    photoStoragePath,
    photoUpdatedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function deactivateTeamUser(
  uid: string,
  scope: CompanyScope
): Promise<void> {
  const doc = await getDb().collection("users").doc(uid).get();
  if (!doc.exists) throw new Error("Usuário não encontrado.");
  const data = doc.data() as { companyId?: string };
  if (data.companyId !== scope.companyId) throw new Error("Usuário de outra empresa.");

  await doc.ref.update({
    active: false,
    updatedAt: Timestamp.now(),
  });
}

export async function updateUserRole(
  uid: string,
  role: UserRole | null,
  scope: CompanyScope
): Promise<void> {
  const doc = await getDb().collection("users").doc(uid).get();
  if (!doc.exists) throw new Error("Usuário não encontrado.");
  const data = doc.data() as { companyId?: string };
  if (data.companyId !== scope.companyId) throw new Error("Usuário de outra empresa.");

  if (role) {
    await doc.ref.update({
      role,
      cargo: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    });
  } else {
    await doc.ref.update({
      role: "member",
      cargo: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    });
  }
}

/** @deprecated Use updateUserRole */
export async function updateUserCargo(
  uid: string,
  cargo: string | null,
  scope: CompanyScope
): Promise<void> {
  const role = cargo ? normalizeRole(cargo, null) : null;
  await updateUserRole(uid, role, scope);
}

async function countOpenAssignedConversations(
  attendantUid: string,
  scope: CompanyScope,
  windowDays: number
): Promise<number> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  return getSql().conversation.count({
    where: {
      companyId: scope.companyId,
      assignedTo: attendantUid,
      status: "open",
      lastInboundAt: { gte: cutoff },
    },
  });
}

function filterEligibleAttendants(
  attendants: TeamUser[],
  settings: Awaited<ReturnType<typeof getAssignmentSettings>>
): TeamUser[] {
  if (settings.eligibleMemberUids.length === 0) return attendants;
  const allowed = new Set(settings.eligibleMemberUids);
  return attendants.filter((a) => allowed.has(a.uid));
}

async function pickAssignee(
  attendants: TeamUser[],
  scope: CompanyScope,
  settings: Awaited<ReturnType<typeof getAssignmentSettings>>
): Promise<string | null> {
  if (attendants.length === 0) return null;

  const loads = await Promise.all(
    attendants.map(async (a) => ({
      uid: a.uid,
      load: await countOpenAssignedConversations(
        a.uid,
        scope,
        settings.windowDays
      ),
    }))
  );

  const max = settings.maxOpenPerMember;
  const eligible = max
    ? loads.filter((entry) => entry.load < max)
    : loads;
  if (eligible.length === 0) return null;

  if (settings.strategy === "round_robin") {
    const sorted = [...eligible].sort((a, b) => a.uid.localeCompare(b.uid));
    const lastIdx = settings.lastRoundRobinUid
      ? sorted.findIndex((e) => e.uid === settings.lastRoundRobinUid)
      : -1;
    const next = sorted[(lastIdx + 1) % sorted.length];
    return next?.uid || null;
  }

  let bestUid = eligible[0]!.uid;
  let bestLoad = Infinity;
  for (const entry of eligible) {
    if (entry.load < bestLoad) {
      bestLoad = entry.load;
      bestUid = entry.uid;
    }
  }
  return bestUid;
}

export async function tryAssignOnInbound(
  conversationId: string,
  scope: CompanyScope
): Promise<string | null> {
  const settings = await getAssignmentSettings(scope.companyId);
  if (!settings.enabled || settings.mode !== "auto") {
    const conversation = await getConversationById(conversationId, scope);
    return conversation?.assignedTo || null;
  }

  const conversation = await getConversationById(conversationId, scope);
  if (!conversation) return null;

  const shouldReassign =
    !conversation.assignedTo ||
    (settings.reassignIfClosed && conversation.status === "closed");

  if (!shouldReassign) return conversation.assignedTo || null;

  const attendants = filterEligibleAttendants(
    await listAttendants(scope),
    settings
  );
  const bestUid = await pickAssignee(attendants, scope, settings);
  if (!bestUid) return conversation.assignedTo || null;

  await getSql().conversation.update({
    where: { id: conversationId },
    data: {
      assignedTo: bestUid,
      assignedAt: new Date(),
      ...(conversation.status === "closed" ? { status: "open" } : {}),
    },
  });

  if (settings.strategy === "round_robin") {
    await setLastRoundRobinUid(scope.companyId, bestUid);
  }

  return bestUid;
}

export async function getAttendantNameMap(
  scope: CompanyScope
): Promise<Map<string, string>> {
  const users = await listTeamUsers(scope);
  const map = new Map<string, string>();
  for (const user of users) {
    map.set(user.uid, userDisplayName(user));
  }
  return map;
}
