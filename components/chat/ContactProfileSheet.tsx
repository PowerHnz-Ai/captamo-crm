"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ban, ExternalLink, MessageCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  contactAvatarColors,
  contactInitials,
} from "@/lib/chat-utils";
import {
  conversationWindowMessage,
  isWithinConversationWindow,
  toDate,
} from "@/lib/conversation-window";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { appConfirm } from "@/lib/app-dialog";
import { useConversationWindow } from "@/hooks/useConversationWindow";
import { formatFirstResponseTime } from "@/lib/first-response";
import type { Contact, ConversationListItem } from "@/lib/types";

interface AssigneeOption {
  uid: string;
  name: string;
}

interface ContactProfileSheetProps {
  conversation: ConversationListItem;
  contact?: Contact | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  assigneeOptions: AssigneeOption[];
  canReassign: boolean;
  currentUid?: string;
  onConversationUpdated?: (conversation: ConversationListItem) => void;
}

export function ContactProfileSheet({
  conversation,
  contact,
  open,
  onClose,
  onUpdated,
  assigneeOptions,
  canReassign,
  currentUid = "",
  onConversationUpdated,
}: ContactProfileSheetProps) {
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const windowOpen = isWithinConversationWindow(conversation.lastInboundAt);
  const windowCountdown = useConversationWindow(conversation.lastInboundAt);
  const isUnassigned = !conversation.assignedTo;
  const isMine = conversation.assignedTo === currentUid;
  const firstResponseLabel = formatFirstResponseTime(
    conversation.firstResponseAt,
    conversation.createdAt
  );
  const seed = conversation.contactName || conversation.phone;
  const avatar = contactAvatarColors(seed);
  const initials = contactInitials(conversation.contactName, conversation.phone);
  const createdAt = contact?.createdAt
    ? toDate(contact.createdAt as Parameters<typeof toDate>[0])
    : null;

  useEffect(() => {
    if (!open) return;
    setTags((contact?.tags || conversation.contactTags || []).join(", "));
    setNotes(contact?.notes || "");
    setAssignedTo(conversation.assignedTo || "");
    setError("");
  }, [open, contact, conversation]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function saveContactFields() {
    if (!contact?.id) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/contacts", {
        method: "PATCH",
        body: JSON.stringify({
          id: contact.id,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao salvar contato.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function patchConversation(body: Record<string, unknown>) {
    setSaving(true);
    setError("");
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
      if (data.conversation) onConversationUpdated?.(data.conversation);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignment(nextUid: string) {
    setAssignedTo(nextUid);
    if (!canReassign && nextUid !== currentUid && nextUid !== "") return;
    await patchConversation({ assignedTo: nextUid || null });
  }

  const waLink = conversation.phone
    ? `https://wa.me/${conversation.phone.replace(/\D/g, "")}`
    : null;

  /** LGPD: move o contato para a lista de excluídos — nunca mais recebe disparos. */
  async function lgpdExclude() {
    if (!contact?.id) return;
    const confirmed = await appConfirm(
      `Mover "${conversation.contactName || conversation.phone}" para a lista de excluídos? O contato sai da lista e NUNCA mais recebe disparos — mesmo que apareça em uma nova importação (conformidade LGPD).`,
      {
        title: "Excluir da lista (LGPD)",
        destructive: true,
        confirmLabel: "Excluir da lista",
      }
    );
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contact.id,
          archived: true,
          blocked: true,
          optIn: false,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao excluir da lista.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir da lista.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar perfil"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-app-border bg-app-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <h2 className="font-display text-lg font-semibold">Perfil do contato</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-app-muted hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold"
              style={{ background: avatar.background, color: avatar.color }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">
                {conversation.contactName || conversation.phone}
              </p>
              <p className="truncate chat-text-meta text-app-muted">{conversation.phone}</p>
              {contact?.source && (
                <p className="chat-text-meta text-app-subtle">Origem: {contact.source}</p>
              )}
              {createdAt && (
                <p className="chat-text-meta text-app-subtle">
                  Cadastro: {format(createdAt, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Status</h3>
            <div className="flex flex-wrap gap-2">
              <Badge tone={contact?.optIn !== false ? "success" : "neutral"}>
                {contact?.optIn !== false
                  ? "Autoriza campanhas"
                  : "Sem autorização p/ campanhas"}
              </Badge>
              {contact?.blocked && <Badge tone="danger">Bloqueado</Badge>}
              <Badge
                tone={windowOpen ? "success" : "warning"}
                title="Tempo restante para responder livremente; depois só com template"
              >
                {windowOpen && windowCountdown.label
                  ? `Janela 24h: resta ${windowCountdown.label}`
                  : windowOpen
                    ? "Janela 24h aberta"
                    : "Janela 24h fechada"}
              </Badge>
              {conversation.status === "closed" && (
                <Badge tone="neutral">Atendimento encerrado</Badge>
              )}
            </div>
            {firstResponseLabel ? (
              <p className="chat-text-meta text-app-subtle">
                Primeira resposta em {firstResponseLabel}
              </p>
            ) : (
              <p className="chat-text-meta text-amber-300/90">Sem resposta ainda</p>
            )}
            {!windowOpen && (
              <p className="chat-text-meta text-app-subtle">{conversationWindowMessage()}</p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Tags</h3>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="lead, vip"
              className="w-full rounded-xl border border-app-border bg-app-secondary px-3 py-2 text-sm outline-none focus:border-app-accent"
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Observações</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas internas sobre o contato"
              className="w-full rounded-xl border border-app-border bg-app-secondary px-3 py-2 text-sm outline-none focus:border-app-accent"
            />
            <Button type="button" loading={saving} onClick={saveContactFields}>
              Salvar tags e notas
            </Button>
          </section>

          {(canReassign || isUnassigned || isMine) && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Atendimento</h3>
              {isUnassigned && currentUid && (
                <Button
                  type="button"
                  loading={saving}
                  onClick={() => void patchConversation({ assignedTo: currentUid })}
                >
                  Assumir conversa
                </Button>
              )}
              {isMine && !canReassign && (
                <Button
                  type="button"
                  variant="ghost"
                  loading={saving}
                  onClick={() => void patchConversation({ assignedTo: null })}
                >
                  Liberar conversa
                </Button>
              )}
              {canReassign && (
                <>
                  <Select
                    value={assignedTo}
                    onChange={(e) => void saveAssignment(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Sem responsável</option>
                    {assigneeOptions.map((a) => (
                      <option key={a.uid} value={a.uid}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                  {conversation.assignedToName && (
                    <p className="chat-text-meta text-app-subtle">
                      Atual: {conversation.assignedToName}
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Ações rápidas</h3>
            <div className="flex flex-col gap-2">
              {contact?.id && (
                <Link
                  href={`/contacts?id=${contact.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-app-border px-3 py-2 text-sm hover:bg-white/5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir em Contatos
                </Link>
              )}
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-app-border px-3 py-2 text-sm hover:bg-white/5"
                >
                  <MessageCircle className="h-4 w-4" />
                  Iniciar conversa (wa.me)
                </a>
              )}
              {contact?.id && !contact.blocked && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void lgpdExclude()}
                  title="Sai da lista de contatos e nunca mais recebe disparos"
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" />
                  Excluir da lista (LGPD)
                </button>
              )}
            </div>
          </section>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </aside>
    </div>
  );
}
