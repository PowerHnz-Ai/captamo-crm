export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolvePlatformAdminOrError } from "@/lib/platform-admin";

const renameSchema = z.object({ name: z.string().min(1).max(160) });

/** Atualiza dados do cliente (por ora, só o nome de exibição). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const guard = await resolvePlatformAdminOrError(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { companyId } = await params;
    const body = await request.json();
    const parsed = renameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { renameClientCompany } = await import("@/lib/company-provisioning");
    await renameClientCompany(companyId, parsed.data.name);
    return NextResponse.json({ ok: true, companyId, name: parsed.data.name.trim() });
  } catch (error) {
    console.error("[platform/clients PATCH]", error);
    const message = error instanceof Error ? error.message : "Erro ao renomear empresa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Exclui um cliente por completo (contas, checklist e dados do CRM).
 * Exige `?confirm=<companyId>` — confirmação digitada na UI.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const guard = await resolvePlatformAdminOrError(request);
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
