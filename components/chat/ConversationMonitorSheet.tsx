"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ConversationMonitorSummary } from "@/components/chat/ConversationMonitorSummary";
import type { ConversationListItem } from "@/lib/types";

interface ConversationMonitorSheetProps {
  conversation: ConversationListItem;
  open: boolean;
  onClose: () => void;
}

/**
 * Drawer lateral com o resumo de metadados da conversa (visão "monitor"),
 * aberto sob demanda por supervisores (gerente/líder/admin) via botão no ChatPanel.
 */
export function ConversationMonitorSheet({
  conversation,
  open,
  onClose,
}: ConversationMonitorSheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar monitor"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-app-border bg-app-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">Monitor da conversa</h2>
            <p className="truncate chat-text-meta text-app-muted">
              {conversation.contactName || conversation.phone}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-app-muted hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ConversationMonitorSummary conversation={conversation} />
        </div>
      </aside>
    </div>
  );
}
