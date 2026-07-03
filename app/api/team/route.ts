export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { updateTeamUserSchema } from "@/lib/validators";
import { serializeTeamUserAsync } from "@/lib/user-profiles";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "team.view");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const { listTeamUsers } = await import("@/lib/lead-assignment");
    const users = await listTeamUsers({ companyId: authResult.context.companyId });
    const serialized = await Promise.all(users.map(serializeTeamUserAsync));
    return NextResponse.json({ users: serialized });
  } catch (error) {
    console.error("[team GET]", error);
    return NextResponse.json({ error: "Erro ao listar equipe." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "team.manage_roles");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = updateTeamUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const { uid, role, name, jobTitle } = parsed.data;

    if (
      role === undefined &&
      name === undefined &&
      jobTitle === undefined
    ) {
      return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
    }

    const { updateUserRole, updateUserProfile, getTeamUser } = await import(
      "@/lib/lead-assignment"
    );

    if (role !== undefined) {
      await updateUserRole(uid, role, scope);
    }

    if (name !== undefined || jobTitle !== undefined) {
      await updateUserProfile(
        uid,
        {
          ...(name !== undefined ? { name } : {}),
          ...(jobTitle !== undefined ? { jobTitle } : {}),
        },
        scope
      );
    }

    const user = await getTeamUser(uid, scope);
    return NextResponse.json({
      ok: true,
      user: user ? await serializeTeamUserAsync(user) : null,
    });
  } catch (error) {
    console.error("[team PATCH]", error);
    const message = error instanceof Error ? error.message : "Erro ao atualizar usuário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "team.manage_roles");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const uid = request.nextUrl.searchParams.get("uid")?.trim();
  if (!uid) {
    return NextResponse.json({ error: "uid obrigatório." }, { status: 400 });
  }

  if (uid === authResult.context.auth?.uid) {
    return NextResponse.json(
      { error: "Você não pode remover a si mesmo." },
      { status: 400 }
    );
  }

  try {
    const { deactivateTeamUser } = await import("@/lib/lead-assignment");
    await deactivateTeamUser(uid, { companyId: authResult.context.companyId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[team DELETE]", error);
    const message = error instanceof Error ? error.message : "Erro ao remover usuário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
