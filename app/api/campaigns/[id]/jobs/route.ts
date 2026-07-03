export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const { id } = await params;
    const syncParam = request.nextUrl.searchParams.get("sync");
    const scope = { companyId: authResult.context.companyId };

    const { getCampaign, listCampaignJobs } = await import("@/lib/campaign-queue");
    const campaign = await getCampaign(id, scope);
    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
    }

    let shouldSync = syncParam === "true";
    if (syncParam === null) {
      if (campaign.status === "running") {
        shouldSync = true;
      } else if (campaign.status === "finished" && campaign.updatedAt) {
        const updatedMs = campaign.updatedAt.toMillis?.() ?? 0;
        const hoursSince = (Date.now() - updatedMs) / (1000 * 60 * 60);
        shouldSync = hoursSince < 24;
      }
    }

    if (shouldSync) {
      const { syncCampaignJobStatuses } = await import("@/lib/campaign-status-sync");
      await syncCampaignJobStatuses(id, scope);
    }

    const jobs = await listCampaignJobs(id, scope);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("[campaigns jobs GET]", error);
    return NextResponse.json({ error: "Erro ao listar jobs." }, { status: 500 });
  }
}
