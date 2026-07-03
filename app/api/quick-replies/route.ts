export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import { can, canMonitorConversations } from "@/lib/permissions";
import { getEffectiveRole } from "@/lib/roles";
import {
  canManageCompanyQuickReplies,
  createQuickReply,
  listQuickReplies,
} from "@/lib/quick-replies";
import { createQuickReplySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const authCheck = requireAuth(authResult.context.auth);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const role = getEffectiveRole(authCheck.auth);
  const canList =
    can(authCheck.auth, "conversations.reply") ||
    canMonitorConversations(authCheck.auth) ||
    canManageCompanyQuickReplies(role);

  if (!canList) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const quickReplies = await listQuickReplies(
      { companyId: authResult.context.companyId },
      authCheck.auth.uid
    );
    return NextResponse.json({ quickReplies });
  } catch (error) {
    console.error("[quick-replies GET]", error);
    return NextResponse.json({ error: "Erro ao listar respostas rápidas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "conversations.reply");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = createQuickReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const role = getEffectiveRole(authResult.context.auth!);
    if (
      parsed.data.scope === "company" &&
      !canManageCompanyQuickReplies(role)
    ) {
      return NextResponse.json(
        { error: "Sem permissão para criar resposta rápida da empresa." },
        { status: 403 }
      );
    }

    const quickReply = await createQuickReply(
      parsed.data,
      { companyId: authResult.context.companyId },
      authResult.context.auth!.uid
    );
    return NextResponse.json({ quickReply }, { status: 201 });
  } catch (error) {
    console.error("[quick-replies POST]", error);
    return NextResponse.json({ error: "Erro ao criar resposta rápida." }, { status: 500 });
  }
}
