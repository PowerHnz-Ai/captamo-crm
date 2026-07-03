export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { createContactListSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { listContactLists } = await import("@/lib/firestore-repositories");
    const lists = await listContactLists({ companyId: authResult.context.companyId });
    return NextResponse.json({ lists });
  } catch (error) {
    console.error("[contact-lists GET]", error);
    return NextResponse.json({ error: "Erro ao listar segmentos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "lists.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = createContactListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { createContactList } = await import("@/lib/firestore-repositories");
    const list = await createContactList(parsed.data, {
      companyId: authResult.context.companyId,
    });
    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    console.error("[contact-lists POST]", error);
    return NextResponse.json({ error: "Erro ao criar segmento." }, { status: 500 });
  }
}
