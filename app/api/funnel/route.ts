export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";

export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { listPipelineStages, listDeals } = await import(
    "@/lib/funnel-repositories"
  );
  const scope = { companyId: context.companyId };
  const [stages, deals] = await Promise.all([
    listPipelineStages(scope),
    listDeals(scope),
  ]);

  return NextResponse.json({ stages, deals });
}

export async function POST(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { createDealSchema } = await import("@/lib/validators");
  const parsed = createDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { createDeal } = await import("@/lib/funnel-repositories");
  const deal = await createDeal(parsed.data, { companyId: context.companyId });
  return NextResponse.json({ deal }, { status: 201 });
}
