export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-server";
import { getTeamUser } from "@/lib/lead-assignment";
import {
  assertCompanyMediaPath,
  downloadStorageMedia,
} from "@/lib/media-storage";

export async function GET(request: NextRequest) {
  const auth = await verifyAuthToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const uid = request.nextUrl.searchParams.get("uid")?.trim();
  if (!uid) {
    return NextResponse.json({ error: "uid obrigatório." }, { status: 400 });
  }

  try {
    const user = await getTeamUser(uid, { companyId: auth.companyId });
    if (!user?.photoStoragePath) {
      return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
    }

    assertCompanyMediaPath(user.photoStoragePath, auth.companyId);
    const { buffer, mimeType } = await downloadStorageMedia(user.photoStoragePath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[users/avatar GET]", error);
    return NextResponse.json({ error: "Erro ao carregar foto." }, { status: 500 });
  }
}
