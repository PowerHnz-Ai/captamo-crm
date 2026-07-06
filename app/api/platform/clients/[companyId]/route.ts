export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePlatformAdmin } from "@/lib/platform-admin";

/**
 * Exclui um cliente por completo (contas, checklist e dados do CRM).
 * Exige `?confirm=<companyId>` — confirmação digitada na UI.
 */
export async function DELETE(
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
    const confirm = request.nextUrl.searchParams.get("confirm");
    if (confirm !== companyId) {
      return NextResponse.json(
        { error: "Confirmação inválida. Digite o código da empresa para excluir." },
        { status: 400 }
      );
    }

    const { deleteClientCompany, ProvisioningError } = await import(
      "@/lib/company-provisioning"
    );
    try {
      const result = await deleteClientCompany(companyId);
      console.warn(
        `[platform] empresa ${companyId} excluída por ${guard.auth.uid} (${result.usersDeleted} usuário(s))`
      );
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof ProvisioningError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  } catch (error) {
    console.error("[platform/clients DELETE]", error);
    return NextResponse.json({ error: "Erro ao excluir empresa." }, { status: 500 });
  }
}
