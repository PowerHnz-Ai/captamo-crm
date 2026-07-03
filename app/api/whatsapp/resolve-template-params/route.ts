export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { contactRefFieldKeysFromOrigin } from "@/lib/campaign-origin-defaults";
import { buildCampaignParametersAsync } from "@/lib/campaign-params-server";
import { resolveCompanyContext } from "@/lib/request-company";
import { normalizePhone } from "@/lib/whatsapp/phone";

const schema = z.object({
  phone: z.string().min(10),
  parameterMapping: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const parsed = schema.parse(await request.json());
    const scope = { companyId: context.companyId };
    const phone = normalizePhone(parsed.phone);

    const { findContactByPhone } = await import("@/lib/firestore-repositories");
    const contact = await findContactByPhone(phone, scope);
    if (!contact) {
      return NextResponse.json(
        { error: "Contato não encontrado." },
        { status: 404 }
      );
    }

    let contactRefKeys: Set<string> | undefined;
    if (contact.originId) {
      const { getContactOriginById } = await import("@/lib/contact-origins");
      const origin = await getContactOriginById(contact.originId, scope);
      contactRefKeys = contactRefFieldKeysFromOrigin(origin);
    }

    const parameters = await buildCampaignParametersAsync(
      contact,
      parsed.parameterMapping,
      scope,
      contactRefKeys
    );

    return NextResponse.json({ parameters });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[resolve-template-params]", error);
    return NextResponse.json(
      { error: "Erro ao resolver variáveis do template." },
      { status: 500 }
    );
  }
}
