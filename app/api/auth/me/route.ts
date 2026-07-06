export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthTokenWithReason, getAuthFailureMessage } from "@/lib/auth-server";
import { getEffectiveRole } from "@/lib/roles";
import { resolveUserPhotoUrl } from "@/lib/user-profiles";
import { isPlatformAdmin } from "@/lib/platform-admin";

export async function GET(request: NextRequest) {
  const { auth, reason } = await verifyAuthTokenWithReason(
    request.headers.get("authorization")
  );

  if (!auth) {
    return NextResponse.json(
      {
        authenticated: false,
        error: getAuthFailureMessage(reason || "missing_header"),
        reason,
      },
      { status: 401 }
    );
  }

  const photoUrl = auth.photoStoragePath
    ? await resolveUserPhotoUrl({
        uid: auth.uid,
        photoStoragePath: auth.photoStoragePath,
      })
    : undefined;

  return NextResponse.json({
    authenticated: true,
    uid: auth.uid,
    email: auth.email,
    name: auth.name,
    jobTitle: auth.jobTitle,
    username: auth.username,
    companyId: auth.companyId,
    role: auth.role,
    cargo: auth.cargo,
    effectiveRole: getEffectiveRole(auth),
    platformAdmin: isPlatformAdmin(auth),
    photoStoragePath: auth.photoStoragePath,
    photoUrl,
  });
}
