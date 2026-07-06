export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createClientSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const guard = requirePlatformAdmin(authResult.context.auth);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { listClientCompanies } = await import("@/lib/company-provisioning");
    const companies = await listClientCompanies();
    return NextResponse.json({ companies });
  } catch (error) {
    console.error("[platform/clients GET]", error);
    return NextResponse.json({ error: "Erro ao listar empresas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const guard = requirePlatformAdmin(authResult.context.auth);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { createClientCompany } = await import("@/lib/company-provisioning");
    const result = await createClientCompany(parsed.data, guard.auth.uid);

    return NextResponse.json(
      {
        ok: true,
        companyId: result.companyId,
        // e-mail retornado para o cliente disparar sendPasswordResetEmail.
        managerEmail: result.managerEmail,
      },
      { status: 201 }
    );
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Erro ao cadastrar cliente.";
    if (status === 500) console.error("[platform/clients POST]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
