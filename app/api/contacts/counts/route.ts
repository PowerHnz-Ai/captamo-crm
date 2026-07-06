export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";

/** Contadores por origem + tags disponíveis (tabs e filtros da tela de contatos). */
export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "contacts.read");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const { getContactsAggregates } = await import("@/lib/firestore-repositories");
    const { countsByOrigin, total, tags } = await getContactsAggregates({
      companyId: authResult.context.companyId,
    });
    return NextResponse.json({ counts: { all: total, ...countsByOrigin }, tags });
  } catch (error) {
    console.error("[contacts counts GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar contadores." },
      { status: 500 }
    );
  }
}
