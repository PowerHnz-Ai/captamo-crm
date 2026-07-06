"use client";

import { useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { ConversationListItem } from "@/lib/types";

interface ConversationLabelsProps {
  conversation: ConversationListItem;
  onUpdated?: (conversation: ConversationListItem) => void;
  /** Somente exibição (sem editar) — usado na lista de threads. */
  readOnly?: boolean;
  compact?: boolean;
}

/** Chips de etiquetas da conversa (distintas das tags do contato). */
export function ConversationLabels({
  conversation,
  onUpdated,
  readOnly = false,
  compact = false,
}: ConversationLabelsProps) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const labels = conversation.labels || [];

  async function saveLabels(next: string[]) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels: next }),
      });
      const data = await parseApiJson<{
        conversation?: ConversationListItem;
        error?: string;
      }>(res);
      if (res.ok && data.conversation) onUpdated?.(data.conversation);
    } finally {
      setBusy(false);
      setAdding(false);
      setInput("");
    }
  }

  if (readOnly) {
    if (labels.length === 0) return null;
    const visible = compact ? labels.slice(0, 2) : labels;
    return (
      <span className="flex flex-wrap items-center gap-1">
        {visible.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-0.5 rounded-full bg-app-accent/15 px-1.5 py-0.5 text-[0.625rem] font-medium text-app-accent"
          >
            <Tag className="h-2.5 w-2.5" />
            {label}
          </span>
        ))}
        {compact && labels.length > 2 && (
          <span className="text-[0.625rem] text-app-muted">
            +{labels.length - 2}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 rounded-full bg-app-accent/15 px-2 py-0.5 text-[0.6875rem] font-medium text-app-accent"
        >
          <Tag className="h-3 w-3" />
          {label}
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveLabels(labels.filter((l) => l !== label))}
            className="rounded-full hover:text-app-text disabled:opacity-50"
            aria-label={`Remover etiqueta ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = input.trim();
            if (!value) {
              setAdding(false);
              return;
            }
            void saveLabels([...labels, value]);
          }}
          className="inline-flex"
        >
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => {
              if (!input.trim()) setAdding(false);
            }}
            maxLength={40}
            placeholder="etiqueta"
            className="w-24 rounded-full border border-app-border bg-transparent px-2 py-0.5 text-[0.6875rem] outline-none"
          />
        </form>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-app-border px-2 py-0.5 text-[0.6875rem] text-app-muted transition-colors hover:border-app-accent hover:text-app-accent disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Etiqueta
        </button>
      )}
    </div>
  );
}
