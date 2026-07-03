"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { applyQuickReplyVariables } from "@/lib/chat-utils";
import type { QuickReply } from "@/lib/types";

interface QuickReplyPickerProps {
  contactName?: string;
  contactPhone?: string;
  onInsert: (text: string) => void;
  onSend: (text: string) => Promise<void>;
  slashQuery?: string;
}

export function QuickReplyPicker({
  contactName,
  contactPhone,
  onInsert,
  onSend,
  slashQuery,
}: QuickReplyPickerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open && !slashQuery) return;
    let active = true;
    setLoading(true);
    apiFetch("/api/quick-replies")
      .then((res) => parseApiJson<{ quickReplies?: QuickReply[] }>(res))
      .then((data) => {
        if (active) setItems(data.quickReplies || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, slashQuery]);

  const filtered = useMemo(() => {
    const q = (slashQuery || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q)
    );
  }, [items, slashQuery]);

  const visible = open || Boolean(slashQuery);

  function resolveBody(body: string) {
    return applyQuickReplyVariables(body, {
      name: contactName,
      phone: contactPhone,
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-app-subtle hover:bg-white/5 hover:text-amber-300"
        aria-label="Respostas rápidas"
      >
        <Zap className="h-5 w-5" />
      </button>

      {visible && (
        <div className="absolute bottom-12 left-0 z-30 w-72 max-h-64 overflow-y-auto rounded-xl border border-app-border bg-app-secondary p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold text-app-muted">
            Respostas rápidas
          </p>
          {loading && (
            <p className="px-2 py-2 text-xs text-app-subtle">Carregando...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="px-2 py-2 text-xs text-app-subtle">
              Nenhuma resposta rápida encontrada.
            </p>
          )}
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-transparent hover:border-app-border hover:bg-white/5"
            >
              <button
                type="button"
                onClick={() => {
                  onInsert(resolveBody(item.body));
                  setOpen(false);
                }}
                className="w-full px-2 py-2 text-left"
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="line-clamp-2 text-xs text-app-muted">{item.body}</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  void onSend(resolveBody(item.body));
                  setOpen(false);
                }}
                className="w-full border-t border-app-border/50 px-2 py-1 text-[0.625rem] text-emerald-300 hover:bg-white/5"
              >
                Enviar direto
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
