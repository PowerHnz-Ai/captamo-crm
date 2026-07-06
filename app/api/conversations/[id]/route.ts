export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { memberCanAccessConversation, memberCanModifyConversation } from "@/lib/conversation-access";
import { resolveCompanyContext } from "@/lib/request-company";
import {
  canMonitorConversations,
  canReadConversationContent,
  can,
} from "@/lib/permissions";
import { getEffectiveRole } from "@/lib/roles";
import type { ConversationListItem } from "@/lib/types";

const patchSchema = z.object({
  assignedTo: z.string().nullable().optional(),
  /** Comentário opcional ao transferir — vira nota interna na timeline. */
  transferComment: z.string().max(1000).optional(),
  status: z.enum(["open", "closed"]).optional(),
  markUnread: z.boolean().optional(),
  markRead: z.boolean().optional(),
  connectionId: z.string().optional(),
  labels: z.array(z.string().min(1).max(40)).max(20).optional(),
});

async function enrichConversation(
  conversation: ConversationListItem,
  companyId: string
): Promise<ConversationListItem> {
  const { getAttendantNameMap } = await import("@/lib/lead-assignment");
  const nameMap = await getAttendantNameMap({ companyId });
  return {
    ...conversation,
    assignedToName: conversation.assignedTo
      ? nameMap.get(conversation.assignedTo)
      : undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const auth = context.auth;
  const canRead = canReadConversationContent(auth);
  const canMonitor = canMonitorConversations(auth);

  if (!canRead && !canMonitor) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { getConversationById } = await import("@/lib/firestore-repositories");
    const { getContactById } = await import("@/lib/firestore-repositories");

    const conversation = await getConversationById(id, { companyId: context.companyId });
    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    if (canRead && !memberCanAccessConversation(auth, conversation)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const contact = await getContactById(conversation.contactId, {
      companyId: context.companyId,
    });

    const enriched = await enrichConversation(conversation, context.companyId);
    const monitorMode = !canRead && canMonitor;

    return NextResponse.json({
      conversation: {
        ...enriched,
        lastMessagePreview: monitorMode ? undefined : conversation.lastMessagePreview,
        contactName: contact?.name,
        contactTags: contact?.tags,
      },
      contact: contact || null,
      monitorMode,
    });
  } catch (error) {
    console.error("[conversations/id GET]", error);
    return NextResponse.json({ error: "Erro ao carregar conversa." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const auth = context.auth;
  if (!canReadConversationContent(auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const { id } = await params;

    const hasUpdate =
      body.assignedTo !== undefined ||
      body.status !== undefined ||
      body.markUnread === true ||
      body.markRead === true ||
      body.connectionId !== undefined ||
      body.labels !== undefined;

    if (!hasUpdate) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }

    const {
      getConversationById,
      updateConversationAssignment,
      updateConversationStatus,
      markConversationUnread,
      markConversationRead,
      updateConversationConnection,
      updateConversationLabels,
      saveInternalNote,
    } = await import("@/lib/firestore-repositories");

    let conversation = await getConversationById(id, { companyId: context.companyId });
    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    const role = getEffectiveRole(auth);
    const canAssignAnyone = role !== "member" && can(auth, "team.view");

    if (body.assignedTo !== undefined) {
      if (!canAssignAnyone) {
        if (body.assignedTo === auth.uid) {
          if (conversation.assignedTo && conversation.assignedTo !== auth.uid) {
            return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
          }
        } else if (body.assignedTo === null) {
          if (conversation.assignedTo !== auth.uid) {
            return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
          }
        } else {
          return NextResponse.json(
            { error: "Você só pode atribuir a si mesmo." },
            { status: 403 }
          );
        }
      }

      await updateConversationAssignment(
        id,
        body.assignedTo,
        { companyId: context.companyId }
      );

      // Transferência com comentário: registra nota interna com o contexto.
      if (body.assignedTo && body.assignedTo !== auth.uid) {
        const { getAttendantNameMap } = await import("@/lib/lead-assignment");
        const { messageSenderFromAuth } = await import("@/lib/user-profiles");
        const nameMap = await getAttendantNameMap({ companyId: context.companyId });
        const targetName = nameMap.get(body.assignedTo) || "atendente";
        const noteBody = body.transferComment?.trim()
          ? `Transferida para ${targetName}: ${body.transferComment.trim()}`
          : `Transferida para ${targetName}.`;
        await saveInternalNote(
          id,
          noteBody,
          messageSenderFromAuth(auth),
          { companyId: context.companyId }
        ).catch(() => null);
      }

      conversation = {
        ...conversation,
        assignedTo: body.assignedTo || undefined,
      };
    }

    if (body.status !== undefined) {
      if (!memberCanModifyConversation(auth, conversation) && !canAssignAnyone) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }
      await updateConversationStatus(id, body.status, {
        markRead: body.status === "closed",
      });
      conversation = { ...conversation, status: body.status };
    }

    if (body.markUnread === true) {
      if (!memberCanModifyConversation(auth, conversation) && !canAssignAnyone) {
        if (!conversation.assignedTo || conversation.assignedTo !== auth.uid) {
          return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
        }
      }
      await markConversationUnread(id);
      conversation = { ...conversation, unreadCount: 1 };
    }

    if (body.markRead === true) {
      await markConversationRead(id);
      conversation = { ...conversation, unreadCount: 0 };
    }

    if (body.connectionId !== undefined) {
      await updateConversationConnection(id, body.connectionId);
      conversation = { ...conversation, connectionId: body.connectionId };
    }

    if (body.labels !== undefined) {
      await updateConversationLabels(id, body.labels, {
        companyId: context.companyId,
      });
      conversation = { ...conversation, labels: body.labels };
    }

    const fresh = await getConversationById(id, { companyId: context.companyId });
    const enriched = await enrichConversation(fresh || conversation, context.companyId);

    const { publishRealtime } = await import("@/lib/realtime");
    publishRealtime(context.companyId, {
      type: "conversation:updated",
      conversationId: id,
    });

    return NextResponse.json({ conversation: enriched });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[conversations/id PATCH]", error);
    return NextResponse.json({ error: "Erro ao atualizar conversa." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const auth = context.auth;
  if (!canReadConversationContent(auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { getConversationById, deleteConversation } = await import(
      "@/lib/firestore-repositories"
    );

    const conversation = await getConversationById(id, {
      companyId: context.companyId,
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    const role = getEffectiveRole(auth);
    const canAssignAnyone = role !== "member" && can(auth, "team.view");

    if (
      !canAssignAnyone &&
      getEffectiveRole(auth) === "member" &&
      !memberCanModifyConversation(auth, conversation)
    ) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const removed = await deleteConversation(id, {
      companyId: context.companyId,
    });
    if (!removed) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    const { publishRealtime } = await import("@/lib/realtime");
    publishRealtime(context.companyId, {
      type: "conversation:updated",
      conversationId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[conversations/id DELETE]", error);
    return NextResponse.json(
      {
        error: "Erro ao excluir conversa.",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
