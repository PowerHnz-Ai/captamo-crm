"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toDate } from "@/lib/conversation-window";
import { formatFirstResponseTime } from "@/lib/first-response";
import { useConversationWindow } from "@/hooks/useConversationWindow";
import type { ConversationListItem } from "@/lib/types";

/**
 * Resumo de metadados de uma conversa (status, janela 24h, último evento,
 * atendente, primeira resposta, não lidas) — a visão "monitor". Reutilizado
 * pelo MonitorPanel (modo monitor) e pelo botão Monitor do ChatPanel.
 */
export function ConversationMonitorSummary({
  conversation,
}: {
  conversation: ConversationListItem;
}) {
  const window = useConversationWindow(conversation.lastInboundAt);
  const lastDate = toDate(conversation.lastMessageAt as Parameters<typeof toDate>[0]);
  const lastAt = lastDate
    ? formatDistanceToNow(lastDate, { addSuffix: true, locale: ptBR })
    : "—";
  const firstResponseLabel = formatFirstResponseTime(
    conversation.firstResponseAt,
    conversation.createdAt
  );

  return (
    <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">
      <h3 className="mb-3 text-sm font-semibold text-app-text">Resumo da conversa</h3>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-app-muted">Status</dt>
          <dd>{conversation.status === "open" ? "Aberta" : "Fechada"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-app-muted">Janela 24h</dt>
          <dd>{window.open ? `Aberta — resta ${window.label}` : "Fechada"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-app-muted">Último evento</dt>
          <dd>{lastAt}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-app-muted">Atendente</dt>
          <dd>{conversation.assignedToName || "Não atribuído"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-app-muted">Primeira resposta</dt>
          <dd>{firstResponseLabel || "Sem resposta"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-app-muted">Não lidas</dt>
          <dd>{conversation.unreadCount || 0}</dd>
        </div>
      </dl>
    </div>
  );
}
