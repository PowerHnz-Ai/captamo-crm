export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthTokenWithReason } from "@/lib/auth-server";
import { canManageTeamRoles } from "@/lib/permissions";
import { setUserAvatarPath } from "@/lib/lead-assignment";
import {
  AVATAR_MAX_BYTES,
  assertCompanyMediaPath,
  isAllowedAvatarMimeType,
  uploadUserAvatar,
} from "@/lib/media-storage";
import { resolveUserPhotoUrl } from "@/lib/user-profiles";

export async function POST(request: NextRequest) {
  const { auth } = await verifyAuthTokenWithReason(
    request.headers.get("authorization")
  );
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const targetUid = request.nextUrl.searchParams.get("uid")?.trim() || auth.uid;
  if (targetUid !== auth.uid && !canManageTeamRoles(auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatório." }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedAvatarMimeType(mimeType)) {
      return NextResponse.json(
        { error: "Formato inválido. Use JPEG, PNG ou WebP." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > AVATAR_MAX_BYTES) {
      return NextResponse.json(
        { error: "Imagem muito grande (máx. 2 MB)." },
        { status: 400 }
      );
    }

    const { storagePath } = await uploadUserAvatar({
      companyId: auth.companyId,
      uid: targetUid,
      buffer,
      mimeType,
      filename: file.name || undefined,
    });

    assertCompanyMediaPath(storagePath, auth.companyId);
    await setUserAvatarPath(targetUid, storagePath, { companyId: auth.companyId });

    const photoUrl = await resolveUserPhotoUrl({
      uid: targetUid,
      photoStoragePath: storagePath,
    });

    return NextResponse.json({ photoStoragePath: storagePath, photoUrl });
  } catch (error) {
    console.error("[me/avatar POST]", error);
    const message = error instanceof Error ? error.message : "Erro ao enviar foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
