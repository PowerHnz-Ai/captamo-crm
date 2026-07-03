export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { importCampaignContactsSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "campaigns.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = importCampaignContactsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const { importContacts } = await import("@/lib/firestore-repositories");

    const defaultOriginId = parsed.data.originId;

    const rows = parsed.data.contacts.map((c) => ({
      name: c.name || c.phone,
      phone: c.phone,
      tags: [...new Set([parsed.data.tag, ...(c.tags || [])])],
      source: "campanha",
      optIn: true,
      customFields: c.customFields,
      originId: c.originId || defaultOriginId,
      originFields: c.originFields,
    }));

    const result = await importContacts(rows, scope, {
      duplicatePolicy: parsed.data.duplicatePolicy,
    });

    return NextResponse.json({
      tag: parsed.data.tag,
      created: result.created,
      skipped: result.skipped,
      updated: result.updated,
      total: parsed.data.contacts.length,
    });
  } catch (error) {
    console.error("[campaigns/import-contacts]", error);
    const message =
      error instanceof Error ? error.message : "Erro ao importar contatos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
