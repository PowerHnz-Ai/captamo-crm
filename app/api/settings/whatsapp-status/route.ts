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

  const perm = requirePermission(authResult.context.auth, "integrations.view");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
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
