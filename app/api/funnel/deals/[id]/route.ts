export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import { moveDealSchema } from "@/lib/validators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = moveDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { moveDealToStage } = await import("@/lib/funnel-repositories");
  const deal = await moveDealToStage(id, parsed.data.stageId, {
    companyId: context.companyId,
  });

  if (!deal) {
    return NextResponse.json({ error: "Deal não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ deal });
}
