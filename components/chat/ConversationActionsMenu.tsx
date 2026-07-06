"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { ConversationListItem } from "@/lib/types";

interface AssigneeOption {
  uid: string;
  name: string;
}

interface ConversationActionsMenuProps {
  conversation: ConversationListItem;
  currentUid: string;
  canAssignAnyone: boolean;
  assigneeOptions?: AssigneeOption[];
  onUpdated: (conversation: ConversationListItem) => void;
  onAfterMarkUnread?: () => void;
  onDeleted?: () => void;
  onOpenChange?: (open: boolean) => void;
  align?: "left" | "right";
}

interface MenuCoords {
  top: number;
  left?: number;
  right?: number;
}

export function ConversationActionsMenu({
  conversation,
  currentUid,
  canAssignAnyone,
  assigneeOptions = [],
  onUpdated,
  onAfterMarkUnread,
  onDeleted,
  onOpenChange,
  align = "right",
}: ConversationActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferComment, setTransferComment] = useState("");
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isClosed = conversation.status === "closed";
  const isUnassigned = !conversation.assignedTo;
  const isMine = conversation.assignedTo === currentUid;
  const canModify = canAssignAnyone || isMine;

  function setMenuOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setShowTransfer(false);
      setTransferComment("");
    }
  }

  function updateMenuPosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setMenuCoords({
      top: rect.bottom + 4,
      ...(align === "right"
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
    });
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
      setMenuOpen(false);
    }

    function handleScroll(e: Event) {
      // Rolagem dentro do próprio menu (ex.: lista de transferência) não fecha.
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) {
        return;
      }
      // Rolagem fora: segue o botão em vez de fechar.
      updateMenuPosition();
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
  }, [open, align]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseApiJson<{
        conversation?: ConversationListItem;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar.");
      if (data.conversation) onUpdated(data.conversation);
      setMenuOpen(false);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao atualizar.", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const items: Array<{
    key: string;
    label: string;
    onClick: () => void;
    destructive?: boolean;
    danger?: boolean;
  }> = [];

  if (isUnassigned || (!isMine && canAssignAnyone)) {
    items.push({
      key: "claim",
      label: "Assumir conversa",
      onClick: () => void patch({ assignedTo: currentUid }),
    });
  }

  if (canAssignAnyone && !isUnassigned) {
    items.push({
      key: "transfer",
      label: "Transferir atendimento",
      onClick: () => setShowTransfer(true),
    });
  }

  if (isMine && !canAssignAnyone) {
    items.push({
      key: "release",
      label: "Liberar conversa",
      onClick: () => void patch({ assignedTo: null }),
    });
  }

  if (canModify || canAssignAnyone) {
    if (isClosed) {
      items.push({
        key: "reopen",
        label: "Reabrir conversa",
        onClick: () => void patch({ status: "open" }),
      });
    } else {
      items.push({
        key: "close",
        label: "Encerrar atendimento",
        onClick: () => void patch({ status: "closed" }),
        destructive: true,
      });
    }
  }

  if (canModify && !isUnassigned) {
    items.push({
      key: "unread",
      label: "Marcar como não visualizada",
      onClick: () =>
        void patch({ markUnread: true }).then(() => onAfterMarkUnread?.()),
    });
  }

  if (canModify || canAssignAnyone) {
    items.push({
      key: "delete",
      label: "Excluir conversa",
      danger: true,
      onClick: () => void handleDelete(),
    });
  }

  async function handleDelete() {
    const ok = await appConfirm(
      "Excluir esta conversa e todo o histórico de mensagens? O contato será mantido.",
      {
        title: "Excluir conversa",
        destructive: true,
        confirmLabel: "Excluir",
      }
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await apiFetch(`/api/conversations/${conversation.id}`, {
        method: "DELETE",
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao excluir conversa.");
      setMenuOpen(false);
      onDeleted?.();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao excluir.", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) return null;

  const menuPanel = open && menuCoords && (
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[12rem] rounded-xl border border-app-border bg-app-card p-1 shadow-2xl"
      style={{
        top: menuCoords.top,
        left: menuCoords.left,
        right: menuCoords.right,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {showTransfer ? (
        <div className="w-64 p-2">
          <p className="mb-2 px-1 text-xs text-app-muted">Transferir para</p>
          <textarea
            value={transferComment}
            onChange={(e) => setTransferComment(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Comentário para o colega (opcional) — vira nota interna"
            className="mb-2 w-full resize-none rounded-lg border border-app-border bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-app-muted"
          />
          <div className="max-h-48 overflow-y-auto overscroll-contain">
            {assigneeOptions.map((a) => (
              <button
                key={a.uid}
                type="button"
                disabled={busy || a.uid === conversation.assignedTo}
                onClick={() =>
                  void patch({
                    assignedTo: a.uid,
                    ...(transferComment.trim()
                      ? { transferComment: transferComment.trim() }
                      : {}),
                  })
                }
                className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5 disabled:opacity-40"
              >
                {a.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowTransfer(false)}
            className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-xs text-app-muted hover:bg-white/5"
          >
            Voltar
          </button>
        </div>
      ) : (
        items.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={busy}
            onClick={item.onClick}
            className={`flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-50 ${
              item.danger
                ? "text-red-300"
                : item.destructive
                  ? "text-amber-300"
                  : ""
            }`}
          >
            {item.label}
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setMenuOpen(false);
          } else {
            updateMenuPosition();
            setMenuOpen(true);
          }
        }}
        disabled={busy}
        className="rounded-lg border border-app-border p-2 hover:bg-white/5 disabled:opacity-50"
        aria-label="Ações da conversa"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {typeof document !== "undefined" && menuPanel
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
}
