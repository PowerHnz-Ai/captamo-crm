export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import { getWhatsAppProvider } from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { getTemplate, updateTemplateStatus } = await import(
      "@/lib/template-repositories"
    );
    const template = await getTemplate(id, { companyId: context.companyId });
    if (!template) {
      return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
    }

    if (!template.requiresMetaApproval) {
      await updateTemplateStatus(id, "approved", {
        approvedAt: Date.now(),
      });
      return NextResponse.json({ success: true, status: "approved" });
    }

    const provider = await getWhatsAppProvider(context.companyId);
    if (!provider.createTemplate) {
      return NextResponse.json(
        { error: "Provedor não suporta criação de templates." },
        { status: 400 }
      );
    }

    const result = await provider.createTemplate({
      name: template.name,
      language: template.language,
      category: template.category,
      body: template.body,
      header: template.header,
      variableSamples: template.variableSamples,
      footer: template.footer,
      buttons: template.buttons,
    });

    await updateTemplateStatus(id, "pending", {
      metaTemplateId: result.id,
      submittedAt: Date.now(),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[templates submit]", error);
    const message = error instanceof Error ? error.message : "Erro ao submeter.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
