export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { listTemplatesForCompany } = await import("@/lib/template-repositories");
    const templates = await listTemplatesForCompany({
      companyId: authResult.context.companyId,
    });
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[templates GET]", error);
    return NextResponse.json({ error: "Erro ao listar templates." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "templates.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const { createTemplateSchema } = await import("@/lib/validators");
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { createTemplateDraft } = await import("@/lib/template-repositories");
    const template = await createTemplateDraft(parsed.data, {
      companyId: authResult.context.companyId,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("[templates POST]", error);
    return NextResponse.json({ error: "Erro ao criar template." }, { status: 500 });
  }
}
