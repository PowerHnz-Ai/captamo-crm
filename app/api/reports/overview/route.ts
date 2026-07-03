export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import { aggregateStatsRange } from "@/lib/stats-daily";
import { getMessagingLimitStatus } from "@/lib/messaging-limits";

export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const days = Number(request.nextUrl.searchParams.get("days") || "30");
  const stats = await aggregateStatsRange(context.companyId, days);
  const limits = await getMessagingLimitStatus(context.companyId);

  return NextResponse.json({ stats, limits, days });
}
