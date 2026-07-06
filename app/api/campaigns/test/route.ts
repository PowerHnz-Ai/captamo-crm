export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { persistOutboundTemplateMessage } from "@/lib/conversation-from-outbound";
import { normalizePhone } from "@/lib/whatsapp/phone";

const testSendSchema = z.object({
  templateName: z.string().min(1),
  phone: z.string().min(10),
  parameters: z.array(z.string()).default([]),
  headerImageAssetId: z.string().optional(),
  headerImageStoragePath: z.string().optional(),
  headerImageMode: z.enum(["fixed", "per_contact"]).optional(),
  headerImageMapping: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  // Envio de teste é envio real (custa dinheiro) — mesma permissão das campanhas.
  const perm = requirePermission(authResult.context.auth, "campaigns.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = testSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const { getTemplateByName } = await import("@/lib/template-repositories");
    const { validateApprovedTemplate } = await import("@/lib/template-validation");
    const { getWhatsAppProvider } = await import("@/lib/whatsapp");

    const templateCheck = validateApprovedTemplate(
      await getTemplateByName(parsed.data.templateName, scope),
      parsed.data.templateName
    );
    if (!templateCheck.ok) {
      return NextResponse.json({ error: templateCheck.error }, { status: 400 });
    }

    const provider = await getWhatsAppProvider(scope.companyId);
    const phone = normalizePhone(parsed.data.phone);

    let headerImage: { storagePath?: string; link?: string } | undefined;
    if (parsed.data.headerImageStoragePath) {
      headerImage = { storagePath: parsed.data.headerImageStoragePath };
    } else if (parsed.data.headerImageAssetId) {
      const { getMediaAssetById } = await import("@/lib/media-asset-repositories");
      const asset = await getMediaAssetById(parsed.data.headerImageAssetId, scope);
      if (asset?.storagePath) {
        headerImage = { storagePath: asset.storagePath };
      }
    }

    const result = await provider.sendTemplate({
      to: phone,
      templateName: parsed.data.templateName,
      language: templateCheck.template.language || "pt_BR",
      parameters: parsed.data.parameters,
      ...(headerImage ? { headerImage } : {}),
    });

    const persisted = await persistOutboundTemplateMessage({
      scope,
      phone,
      contactName: parsed.data.parameters[0] || phone,
      templateName: parsed.data.templateName,
      parameters: parsed.data.parameters,
      headerImageStoragePath: headerImage?.storagePath,
      messageId: result.messageId,
      raw: result.raw,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      phone: persisted.deliveryPhone,
      conversationId: persisted.conversation.id,
      contactId: persisted.contact.id,
    });
  } catch (error) {
    console.error("[campaigns/test]", error);
    const message = error instanceof Error ? error.message : "Erro ao enviar teste.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
