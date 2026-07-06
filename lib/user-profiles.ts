import { getMediaSignedUrl } from "./media-storage";
import type { AuthContext } from "./auth-server";
import type { TeamUser } from "./types";
import { userDisplayName, userChatSignatureName } from "./user-display";

export { userDisplayName, userChatSignatureName, applySenderNameToOutboundBody } from "./user-display";

export function messageSenderFromAuth(auth: AuthContext | null | undefined): {
  sentByUid?: string;
  sentByName?: string;
} {
  if (!auth?.uid) return {};
  return {
    sentByUid: auth.uid,
    sentByName: userChatSignatureName(auth),
  };
}

/** Fallback proxy URL when signed URL is unavailable. */
export function buildUserAvatarUrl(
  uid: string,
  photoUpdatedAt?: number | string | null
): string {
  const params = new URLSearchParams({ uid });
  if (photoUpdatedAt) {
    params.set("v", String(photoUpdatedAt));
  }
  return `/api/users/avatar?${params.toString()}`;
}

export async function resolveUserPhotoUrl(
  user: Pick<TeamUser, "uid" | "photoStoragePath" | "photoUpdatedAt">
): Promise<string | undefined> {
  if (!user.photoStoragePath) return undefined;

  try {
    return await getMediaSignedUrl(user.photoStoragePath);
  } catch (error) {
    console.warn("[user-profiles] Signed URL indisponível, usando proxy:", error);
    return buildUserAvatarUrl(user.uid, user.photoUpdatedAt);
  }
}

export async function serializeTeamUserAsync(user: TeamUser) {
  const photoUrl = await resolveUserPhotoUrl(user);
  return {
    uid: user.uid,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    jobTitle: user.jobTitle,
    photoStoragePath: user.photoStoragePath,
    photoUpdatedAt: user.photoUpdatedAt ?? null,
    photoUrl,
    active: user.active !== false,
  };
}

export function isUserActive(user: { active?: boolean }): boolean {
  return user.active !== false;
}
