import { roleLabel } from "./roles";
import type { UserRole } from "./types";

export type PresenceStatus = "online" | "away" | "offline";
export type PresenceSurface = "hub" | "api" | "checklist";

export interface PresenceRecord {
  uid: string;
  name?: string;
  email?: string;
  role: UserRole;
  status: PresenceStatus;
  currentSurface: PresenceSurface;
  currentPath?: string;
  lastSeenAt: Date;
  updatedAt: Date;
}

export const SURFACE_LABELS: Record<PresenceSurface, string> = {
  hub: "Captamo",
  api: "API Captamo",
  checklist: "Operacional",
};

export function presenceRoleLabel(role: UserRole): string {
  return roleLabel(role);
}
