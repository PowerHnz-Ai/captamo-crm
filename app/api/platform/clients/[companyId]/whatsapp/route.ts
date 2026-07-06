export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformWhatsappConfigSchema } from "@/lib/validators";

/** Config da API oficial de uma clínica — exclusivo do platform admin. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const guard = requirePlatformAdmin(authResult.context.auth);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { companyId } = await params;
    const { getWhatsappConfigStatus } = await import("@/lib/platform-whatsapp");
    const status = await getWhatsappConfigStatus(companyId);
    return NextResponse.json({ status });
  } catch (error) {
    console.error("[platform/whatsapp GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar configuração." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const guard = requirePlatformAdmin(authResult.context.auth);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { companyId } = await params;
    const body = await request.json();
    const parsed = platformWhatsappConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { configureClientWhatsapp, WhatsappConfigError } = await import(
      "@/lib/platform-whatsapp"
    );
    try {
      const status = await configureClientWhatsapp(
        companyId,
        parsed.data,
        guard.auth.uid
      );
      return NextResponse.json({ ok: true, status });
    } catch (error) {
      if (error instanceof WhatsappConfigError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  } catch (error) {
    console.error("[platform/whatsapp PUT]", error);
    return NextResponse.json(
      { error: "Erro ao salvar configuração." },
      { status: 500 }
    );
  }
}
