export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";

/** Estado (somente leitura) da API oficial da própria clínica. */
export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  // Banner de status na página de Conexões (só leitura, sem segredo). Basta
  // ver conexões — Líder/Supervisor têm; a Captamo impersonando também.
  const canConnections = requirePermission(authResult.context.auth, "connections.view");
  if (!canConnections.ok) {
    return NextResponse.json(
      { error: canConnections.error },
      { status: canConnections.status }
    );
  }

  try {
    const { getWhatsappConfigStatus } = await import("@/lib/platform-whatsapp");
    const status = await getWhatsappConfigStatus(authResult.context.companyId);
    return NextResponse.json({ status });
  } catch (error) {
    console.error("[settings/whatsapp-status GET]", error);
    return NextResponse.json({ error: "Erro ao carregar status." }, { status: 500 });
  }
}
