import { Prisma } from "@prisma/client";
import { getSql } from "./db";
import type { AssignmentSettings } from "./types";

export const DEFAULT_ASSIGNMENT_SETTINGS: AssignmentSettings = {
  enabled: true,
  mode: "auto",
  strategy: "least_load",
  eligibleMemberUids: [],
  reassignIfClosed: true,
  windowDays: 7,
};

function sanitizeAssignmentSettings(
  input: Partial<AssignmentSettings> | null | undefined
): AssignmentSettings {
  const base = { ...DEFAULT_ASSIGNMENT_SETTINGS };
  if (!input) return base;

  const mode = input.mode === "manual" ? "manual" : "auto";
  const strategy =
    input.strategy === "round_robin" ? "round_robin" : "least_load";

  return {
    enabled: input.enabled !== false,
    mode,
    strategy,
    eligibleMemberUids: Array.isArray(input.eligibleMemberUids)
      ? input.eligibleMemberUids.filter((uid) => typeof uid === "string" && uid)
      : [],
    maxOpenPerMember:
      typeof input.maxOpenPerMember === "number" && input.maxOpenPerMember > 0
        ? Math.floor(input.maxOpenPerMember)
        : undefined,
    reassignIfClosed: input.reassignIfClosed !== false,
    windowDays:
      typeof input.windowDays === "number" && input.windowDays > 0
        ? Math.min(90, Math.floor(input.windowDays))
        : DEFAULT_ASSIGNMENT_SETTINGS.windowDays,
    lastRoundRobinUid:
      typeof input.lastRoundRobinUid === "string"
        ? input.lastRoundRobinUid
        : undefined,
    inboxAttendantUids: Array.isArray(input.inboxAttendantUids)
      ? input.inboxAttendantUids.filter((uid) => typeof uid === "string" && uid)
      : [],
    inboxAttendantOrder: Array.isArray(input.inboxAttendantOrder)
      ? input.inboxAttendantOrder.filter((uid) => typeof uid === "string" && uid)
      : [],
  };
}

/** JSON serializável — remove chaves undefined antes de gravar. */
function toJson(settings: AssignmentSettings): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(settings)) as Prisma.InputJsonValue;
}

export async function getAssignmentSettings(
  companyId: string
): Promise<AssignmentSettings> {
  const row = await getSql().companySettings.findUnique({
    where: { companyId },
    select: { assignmentSettings: true },
  });
  const raw = row?.assignmentSettings as Partial<AssignmentSettings> | null;
  return sanitizeAssignmentSettings(raw);
}

export async function updateAssignmentSettings(
  companyId: string,
  patch: Partial<AssignmentSettings>
): Promise<AssignmentSettings> {
  const current = await getAssignmentSettings(companyId);
  const merged = sanitizeAssignmentSettings({ ...current, ...patch });

  await getSql().companySettings.upsert({
    where: { companyId },
    create: { companyId, assignmentSettings: toJson(merged) },
    update: { assignmentSettings: toJson(merged) },
  });
  return merged;
}

export async function setLastRoundRobinUid(
  companyId: string,
  uid: string
): Promise<void> {
  await updateAssignmentSettings(companyId, { lastRoundRobinUid: uid });
}
