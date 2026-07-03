export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  try {
    const { getTemplate } = await import("@/lib/template-repositories");
    const template = await getTemplate(id, { companyId: authResult.context.companyId });
    if (!template) {
      return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    console.error("[templates GET id]", error);
    return NextResponse.json({ error: "Erro ao carregar template." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "templates.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { updateTemplateSchema } = await import("@/lib/validators");
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { updateTemplateDraft } = await import("@/lib/template-repositories");
    const template = await updateTemplateDraft(
      id,
      parsed.data,
      { companyId: authResult.context.companyId }
    );

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[templates PATCH id]", error);
    const message = error instanceof Error ? error.message : "Erro ao atualizar template.";
    const status = message.includes("não encontrado") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
