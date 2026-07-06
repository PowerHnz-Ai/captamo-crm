export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { updateTeamUserSchema, createTeamMemberSchema } from "@/lib/validators";
import { serializeTeamUserAsync } from "@/lib/user-profiles";
import { canAssignRole, canManageUser } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getEffectiveRole } from "@/lib/roles";

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

export async function POST(request: NextRequest) {
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
    const parsed = createTeamMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const actor = {
      role: authResult.context.auth!.role,
      cargo: authResult.context.auth!.cargo,
      platformAdmin: isPlatformAdmin(authResult.context.auth),
    };

    // Teto: gerente não cria admin; apenas admin/platform admin criam admin.
    if (!canAssignRole(actor, parsed.data.role)) {
      return NextResponse.json(
        { error: "Você não pode atribuir este cargo." },
        { status: 403 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const { createTeamMember } = await import("@/lib/company-provisioning");
    const { getTeamUser } = await import("@/lib/lead-assignment");

    const created = await createTeamMember(parsed.data, scope);
    const user = await getTeamUser(created.uid, scope);

    return NextResponse.json(
      {
        ok: true,
        // e-mail retornado para o cliente disparar sendPasswordResetEmail.
        email: created.email,
        user: user ? await serializeTeamUserAsync(user) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Erro ao criar usuário.";
    if (status === 500) console.error("[team POST]", error);
    return NextResponse.json({ error: message }, { status });
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

    const actor = {
      role: authResult.context.auth!.role,
      cargo: authResult.context.auth!.cargo,
      platformAdmin: isPlatformAdmin(authResult.context.auth),
    };
    const target = await getTeamUser(uid, scope);
    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Teto: gerente não altera admins existentes...
    if (!canManageUser(actor, target)) {
      return NextResponse.json(
        { error: "Você não pode alterar este usuário." },
        { status: 403 }
      );
    }
    // ...nem promove alguém a admin.
    if (role !== undefined && role !== null && !canAssignRole(actor, role)) {
      return NextResponse.json(
        { error: "Você não pode atribuir este cargo." },
        { status: 403 }
      );
    }

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
    const scope = { companyId: authResult.context.companyId };
    const { deactivateTeamUser, getTeamUser } = await import("@/lib/lead-assignment");

    const actor = {
      role: authResult.context.auth!.role,
      cargo: authResult.context.auth!.cargo,
      platformAdmin: isPlatformAdmin(authResult.context.auth),
    };
    const target = await getTeamUser(uid, scope);
    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    // Teto: gerente não remove admins existentes.
    if (!canManageUser(actor, target)) {
      return NextResponse.json(
        { error: "Você não pode remover este usuário." },
        { status: 403 }
      );
    }

    await deactivateTeamUser(uid, scope);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[team DELETE]", error);
    const message = error instanceof Error ? error.message : "Erro ao remover usuário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
