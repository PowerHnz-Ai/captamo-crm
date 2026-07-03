export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";

export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { getDashboardStats } = await import("@/lib/firestore-repositories");
    const stats = await getDashboardStats({ companyId: context.companyId });
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[dashboard stats]", error);
    return NextResponse.json({ error: "Erro ao carregar estatísticas." }, { status: 500 });
  }
}
