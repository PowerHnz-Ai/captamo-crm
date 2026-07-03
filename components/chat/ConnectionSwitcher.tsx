"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Smartphone } from "lucide-react";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { appAlert } from "@/lib/app-dialog";
import type { ConversationListItem } from "@/lib/types";

export interface ConnectionOption {
  id: string;
  label: string;
  provider: "meta_cloud" | "wasender" | "evolution";
  status: "connected" | "connecting" | "disconnected";
  isDefault?: boolean;
}

interface MenuCoords {
  top: number;
  left: number;
  transform?: string;
}

interface ConnectionSwitcherProps {
  conversation: ConversationListItem;
  onConversationUpdated?: (conversation: ConversationListItem) => void;
  placement?: "header" | "composer";
  connections?: ConnectionOption[];
}

export function ConnectionSwitcher({
  conversation,
  onConversationUpdated,
  placement = "composer",
  connections: connectionsProp,
}: ConnectionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [fetchedConnections, setFetchedConnections] = useState<ConnectionOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const connections = connectionsProp ?? fetchedConnections;

  useEffect(() => {
    if (connectionsProp) return;
    apiFetch("/api/connections")
      .then((r) => parseApiJson<{ connections?: ConnectionOption[] }>(r))
      .then((data) => setFetchedConnections(data.connections || []))
      .catch(() => setFetchedConnections([]));
  }, [connectionsProp]);

  function updateMenuPosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    if (placement === "composer") {
      setMenuCoords({
        top: rect.top - 4,
        left: rect.left,
        transform: "translateY(-100%)",
      });
    } else {
      setMenuCoords({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleScroll() {
      setOpen(false);
    }

    function handleResize() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, placement]);

  const activeId =
    conversation.connectionId ||
    connections.find((c) => c.isDefault)?.id ||
    connections[0]?.id;
  const active = connections.find((c) => c.id === activeId);

  async function select(connectionId: string) {
    if (connectionId === activeId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await parseApiJson<{
        conversation?: ConversationListItem;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao trocar número.");
      if (data.conversation) onConversationUpdated?.(data.conversation);
      setOpen(false);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao trocar número.", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (connections.length === 0) return null;

  const activeLabel = active?.label || "Número";
  const isComposer = placement === "composer";
  const canSwitch = connections.length > 1;

  const menuPanel = open && canSwitch && menuCoords && (
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[14rem] rounded-xl border border-app-border bg-app-card p-1 shadow-2xl"
      style={{
        top: menuCoords.top,
        left: menuCoords.left,
        transform: menuCoords.transform,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="px-3 py-1.5 text-[0.6875rem] uppercase tracking-wide text-app-muted">
        Enviar pelo número
      </p>
      {connections.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={busy}
          onClick={() => select(c.id)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-50"
        >
          <Smartphone className="h-4 w-4 shrink-0 text-app-whatsapp" />
          <span className="min-w-0 flex-1 truncate">{c.label}</span>
          {c.status === "connecting" && (
            <span className="rounded-full bg-app-accent/20 px-1.5 py-0.5 text-[0.625rem] font-semibold text-app-accent">
              Nova
            </span>
          )}
          {c.id === activeId && (
            <Check className="h-4 w-4 shrink-0 text-app-accent" />
          )}
        </button>
      ))}
    </div>
  );

  const chipButton = (
    <button
      ref={buttonRef}
      type="button"
      onClick={(e) => {
        if (!canSwitch) return;
        e.stopPropagation();
        if (open) {
          setOpen(false);
        } else {
          updateMenuPosition();
          setOpen(true);
        }
      }}
      disabled={busy || !canSwitch}
      className={
        isComposer
          ? `relative flex max-w-full items-center gap-1.5 rounded-lg border border-app-border px-2.5 py-1.5 text-xs text-app-subtle hover:text-app-text disabled:cursor-default disabled:opacity-100 ${
              canSwitch ? "hover:bg-white/5" : ""
            }`
          : "flex items-center gap-1.5 rounded-lg border border-app-border px-2.5 py-1.5 text-xs text-app-subtle hover:text-app-text disabled:opacity-50"
      }
      title={`Enviar por: ${activeLabel}`}
      aria-label={`Enviar por: ${activeLabel}`}
      aria-expanded={canSwitch ? open : undefined}
      aria-haspopup={canSwitch ? "listbox" : undefined}
    >
      <span className="relative shrink-0">
        <Smartphone className="h-3.5 w-3.5 text-app-whatsapp" />
        {active?.status === "connected" && (
          <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-app-whatsapp ring-1 ring-[var(--chat-composer-bg)]" />
        )}
      </span>
      <span className="max-w-[180px] truncate text-app-text">{activeLabel}</span>
      {canSwitch && <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />}
    </button>
  );

  return (
    <div className={isComposer ? "min-w-0" : "relative"}>
      {chipButton}
      {typeof document !== "undefined" && menuPanel
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
}
