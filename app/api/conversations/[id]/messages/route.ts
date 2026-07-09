export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { oldestMessageCursor } from "@/lib/message-merge";
import { resolveCompanyContext } from "@/lib/request-company";
import { memberCanAccessConversation } from "@/lib/conversation-access";
import { canReadConversationContent } from "@/lib/permissions";
import { getEffectiveRole } from "@/lib/roles";

const DEFAULT_PAGE_SIZE = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!canReadConversationContent(context.auth)) {
    return NextResponse.json(
      { error: "Sem permissão para ler mensagens." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const {
      getConversationById,
      getContactById,
      listConversationMessages,
      markConversationRead,
      logConversationAccess,
    } = await import("@/lib/firestore-repositories");
    const scope = { companyId: context.companyId };

    const effectiveRole = getEffectiveRole(context.auth);
    if (effectiveRole === "member") {
      const conversation = await getConversationById(id, scope);
      if (!conversation || !memberCanAccessConversation(context.auth, conversation)) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }
    }

    // Auditoria (LGPD): registra a leitura supervisória de gerente/líder. Fire-and-forget:
    // nunca deve bloquear ou derrubar a resposta das mensagens.
    if (effectiveRole === "gerente" || effectiveRole === "leader") {
      void logConversationAccess(
        id,
        {
          uid: context.auth.uid,
          name: context.auth.name ?? context.auth.email ?? null,
          role: effectiveRole,
        },
        scope
      ).catch((err) => {
        console.error("[conversation-access-log]", err);
      });
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const beforeParam = request.nextUrl.searchParams.get("before");
    const limit = limitParam ? Number(limitParam) : DEFAULT_PAGE_SIZE;
    const before = beforeParam ? Number(beforeParam) : undefined;

    const { messages, hasMore } = await listConversationMessages(id, scope, {
      limit: Number.isFinite(limit) ? limit : DEFAULT_PAGE_SIZE,
      before: Number.isFinite(before) ? before : undefined,
    });

    let enriched = messages;
    const conversation = await getConversationById(id, scope);
    if (conversation?.contactId) {
      const contact = await getContactById(conversation.contactId, scope);
      const { enrichConversationMessages } = await import(
        "@/lib/enrich-conversation-messages"
      );
      enriched = await enrichConversationMessages(
        messages,
        scope,
        contact?.name || conversation.phone
      );
    }

    if (request.nextUrl.searchParams.get("markRead") === "true") {
      await markConversationRead(id);
    }

    const oldestCursor = oldestMessageCursor(enriched);

    return NextResponse.json({
      messages: enriched,
      hasMore,
      oldestCursor,
    });
  } catch (error) {
    console.error("[messages GET]", error);
    return NextResponse.json({ error: "Erro ao listar mensagens." }, { status: 500 });
  }
}
