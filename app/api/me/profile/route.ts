export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthTokenWithReason } from "@/lib/auth-server";
import { updateProfileSchema } from "@/lib/validators";
import { updateUserProfile } from "@/lib/lead-assignment";
import { serializeTeamUserAsync } from "@/lib/user-profiles";

export async function PATCH(request: NextRequest) {
  const { auth, reason } = await verifyAuthTokenWithReason(
    request.headers.get("authorization")
  );
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (
      parsed.data.name === undefined &&
      parsed.data.username === undefined &&
      parsed.data.jobTitle === undefined
    ) {
      return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
    }

    const user = await updateUserProfile(
      auth.uid,
      {
        name: parsed.data.name,
        username: parsed.data.username,
        jobTitle: parsed.data.jobTitle,
      },
      { companyId: auth.companyId }
    );

    return NextResponse.json({ user: await serializeTeamUserAsync(user) });
  } catch (error) {
    console.error("[me/profile PATCH]", error);
    const message = error instanceof Error ? error.message : "Erro ao atualizar perfil.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
