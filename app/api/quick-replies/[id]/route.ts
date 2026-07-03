export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { getEffectiveRole } from "@/lib/roles";
import {
  canEditQuickReply,
  deleteQuickReply,
  getQuickReplyById,
  updateQuickReply,
} from "@/lib/quick-replies";
import { updateQuickReplySchema } from "@/lib/validators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "conversations.reply");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const { id } = await params;
    const existing = await getQuickReplyById(id, {
      companyId: authResult.context.companyId,
    });
    if (!existing) {
      return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    }

    const role = getEffectiveRole(authResult.context.auth!);
    if (!canEditQuickReply(existing, authResult.context.auth!.uid, role)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateQuickReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const quickReply = await updateQuickReply(id, parsed.data, {
      companyId: authResult.context.companyId,
    });
    return NextResponse.json({ quickReply });
  } catch (error) {
    console.error("[quick-replies PATCH]", error);
    return NextResponse.json({ error: "Erro ao atualizar." }, { status: 500 });
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

  const perm = requirePermission(authResult.context.auth, "conversations.reply");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const { id } = await params;
    const existing = await getQuickReplyById(id, {
      companyId: authResult.context.companyId,
    });
    if (!existing) {
      return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    }

    const role = getEffectiveRole(authResult.context.auth!);
    if (!canEditQuickReply(existing, authResult.context.auth!.uid, role)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    await deleteQuickReply(id, { companyId: authResult.context.companyId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[quick-replies DELETE]", error);
    return NextResponse.json({ error: "Erro ao excluir." }, { status: 500 });
  }
}
