export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { updateContactListSchema } from "@/lib/validators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateContactListSchema.safeParse({ ...body, id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { updateContactList } = await import("@/lib/firestore-repositories");
    const list = await updateContactList(
      id,
      {
        name: parsed.data.name,
        description: parsed.data.description,
        tagFilter: parsed.data.tagFilter,
        contactIds: parsed.data.contactIds,
      },
      { companyId: authResult.context.companyId }
    );

    if (!list) {
      return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ list });
  } catch (error) {
    console.error("[contact-lists PATCH]", error);
    return NextResponse.json({ error: "Erro ao atualizar lista." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = await params;
    const { deleteContactList } = await import("@/lib/firestore-repositories");
    const deleted = await deleteContactList(id, {
      companyId: authResult.context.companyId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact-lists DELETE]", error);
    return NextResponse.json({ error: "Erro ao excluir lista." }, { status: 500 });
  }
}
