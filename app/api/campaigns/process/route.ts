export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { processAllCompaniesRunningCampaigns } = await import(
      "@/lib/campaign-processor"
    );
    await processAllCompaniesRunningCampaigns();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[campaigns/process]", error);
    return NextResponse.json({ error: "Erro ao processar campanhas." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { processRunningCampaigns } = await import("@/lib/campaign-processor");
    const result = await processRunningCampaigns({
      companyId: authResult.context.companyId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[campaigns/process GET]", error);
    return NextResponse.json({ error: "Erro ao processar campanhas." }, { status: 500 });
  }
}
