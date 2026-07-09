"use client";

import { Badge } from "@/components/ui/Badge";
import { ConversationMonitorSummary } from "@/components/chat/ConversationMonitorSummary";
import type { ConversationListItem } from "@/lib/types";

interface MonitorPanelProps {
  conversation: ConversationListItem | null;
  loading: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function MonitorPanel({
  conversation,
  loading,
  onBack,
  showBackButton,
}: MonitorPanelProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-app-subtle">
        Carregando...
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-app-subtle">
        <p className="text-lg font-medium text-app-text">Modo monitor</p>
        <p className="max-w-sm text-sm">
          Selecione uma conversa para ver metadados sem acessar o conteúdo das mensagens.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-app-border px-4 py-3">
        {showBackButton && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-app-border px-2 py-1 text-xs text-app-subtle lg:hidden"
          >
            Voltar
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            {conversation.contactName || conversation.phone}
          </h2>
          <p className="text-xs text-app-muted">{conversation.phone}</p>
        </div>
        <Badge tone="neutral">Monitor</Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-lg space-y-4">
          <ConversationMonitorSummary conversation={conversation} />

          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200/90">
            O conteúdo das mensagens não é exibido no modo monitor. Apenas metadados da
            conversa estão visíveis.
          </p>
        </div>
      </div>
    </div>
  );
}
