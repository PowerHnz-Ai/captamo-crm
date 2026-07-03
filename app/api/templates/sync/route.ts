export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { getWhatsAppProvider } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const provider = await getWhatsAppProvider(authResult.context.companyId);
    if (!provider.syncTemplates) {
      return NextResponse.json(
        { error: "Provedor não suporta sync de templates." },
        { status: 400 }
      );
    }

    const providerTemplates = await provider.syncTemplates();
    const { syncTemplatesFromProvider } = await import(
      "@/lib/template-repositories"
    );
    const synced = await syncTemplatesFromProvider(
      { companyId: authResult.context.companyId },
      providerTemplates
    );

    return NextResponse.json({
      success: true,
      synced,
      fetched: providerTemplates.length,
      approved: providerTemplates.filter((t) => t.status === "approved").length,
    });
  } catch (error) {
    console.error("[templates sync]", error);
    const message = error instanceof Error ? error.message : "Erro ao sincronizar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
