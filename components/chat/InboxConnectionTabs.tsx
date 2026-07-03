"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { ConnectionOption } from "@/components/chat/ConnectionSwitcher";

interface InboxConnectionTabsProps {
  activeConnectionId: string | null;
  onConnectionChange: (connectionId: string) => void;
  onConnectionsLoaded?: (connections: ConnectionOption[]) => void;
  unreadByConnection?: Record<string, number>;
}

export function InboxConnectionTabs({
  activeConnectionId,
  onConnectionChange,
  onConnectionsLoaded,
  unreadByConnection = {},
}: InboxConnectionTabsProps) {
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await apiFetch("/api/connections");
        const data = await parseApiJson<{ connections?: ConnectionOption[] }>(res);
        if (!active) return;
        const list = data.connections || [];
        setConnections((prev) => {
          const changed =
            prev.length !== list.length ||
            prev.some(
              (c, i) =>
                c.id !== list[i]?.id ||
                c.status !== list[i]?.status ||
                c.label !== list[i]?.label
            );
          if (changed) onConnectionsLoaded?.(list);
          return changed ? list : prev;
        });
      } catch {
        if (active) setConnections([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [onConnectionsLoaded]);

  if (loading && connections.length === 0) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="h-9 w-24 shrink-0 animate-pulse rounded-lg bg-white/5" />
        <div className="h-9 w-24 shrink-0 animate-pulse rounded-lg bg-white/5" />
      </div>
    );
  }

  if (connections.length === 0) return null;

  if (connections.length === 1) {
    const c = connections[0]!;
    const unread = unreadByConnection[c.id] || 0;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-secondary/30 px-3 py-2 text-sm">
        <Smartphone className="h-4 w-4 shrink-0 text-app-whatsapp" />
        <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
        {c.status !== "connected" && (
          <span className="shrink-0 text-xs text-app-muted">Desconectado</span>
        )}
        {unread > 0 && (
          <span className="shrink-0 rounded-full bg-app-accent px-1.5 py-0.5 text-xs font-semibold text-white">
            {unread}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Caixas de entrada"
    >
      {connections.map((c) => {
        const isActive = c.id === activeConnectionId;
        const unread = unreadByConnection[c.id] || 0;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onConnectionChange(c.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              isActive
                ? "border-app-accent/50 bg-app-accent/15 text-app-text"
                : "border-app-border bg-app-secondary/30 text-app-muted hover:bg-white/5 hover:text-app-text"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0 text-app-whatsapp" />
            <span className="max-w-[8rem] truncate font-medium">{c.label}</span>
            {c.status !== "connected" && (
              <span className="text-[0.625rem] text-app-muted">· off</span>
            )}
            {unread > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold ${
                  isActive ? "bg-app-accent text-white" : "bg-white/10 text-app-text"
                }`}
              >
                {unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
