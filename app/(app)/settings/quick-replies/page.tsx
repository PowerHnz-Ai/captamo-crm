"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { usePermissions } from "@/hooks/usePermissions";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { applyQuickReplyVariables } from "@/lib/chat-utils";
import type { QuickReply } from "@/lib/types";

const VARIABLE_CHIPS = [
  { label: "Primeiro nome", token: "{primeiro_nome}" },
  { label: "Nome completo", token: "{nome}" },
  { label: "Telefone", token: "{telefone}" },
] as const;

const PREVIEW_VARS = { name: "Maria Silva", phone: "+55 11 99999-0000" };

export default function QuickRepliesSettingsPage() {
  const { role } = usePermissions();
  const canManageCompany =
    role === "admin" || role === "gerente" || role === "leader";

  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    scope: canManageCompany ? ("company" as const) : ("personal" as const),
  });

  function insertVariable(token: string) {
    const el = bodyRef.current;
    if (!el) {
      setForm((p) => ({ ...p, body: p.body + token }));
      return;
    }
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? start;
    const next = form.body.slice(0, start) + token + form.body.slice(end);
    setForm((p) => ({ ...p, body: next }));
    const cursor = start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function load() {
    setLoading(true);
    apiFetch("/api/quick-replies")
      .then(async (res) => {
        const data = await parseApiJson<{ quickReplies?: QuickReply[]; error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Erro ao carregar");
        setItems(data.quickReplies || []);
      })
      .catch((err) =>
        appAlert(err instanceof Error ? err.message : "Erro ao carregar", {
          title: "Erro",
          variant: "error",
        })
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao criar");
      setForm((prev) => ({ ...prev, title: "", body: "" }));
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    const confirmed = await appConfirm("Excluir esta resposta rápida?", {
      title: "Excluir resposta",
      destructive: true,
      confirmLabel: "Excluir",
    });
    if (!confirmed) return;
    const res = await apiFetch(`/api/quick-replies/${id}`, { method: "DELETE" });
    const data = await parseApiJson<{ error?: string }>(res);
    if (!res.ok) {
      await appAlert(data.error || "Erro ao excluir", { title: "Erro", variant: "error" });
      return;
    }
    load();
  }

  return (
    <AppShell mode="crm">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Respostas rápidas</h1>
          <p className="mt-1 text-sm text-app-muted">
            Atalhos de texto para o inbox. Use variáveis {"{primeiro_nome}"},{" "}
            {"{nome}"} e {"{telefone}"}.
          </p>
        </div>

        <Card className="p-5">
          <form onSubmit={createItem} className="space-y-3">
            <Input
              id="qr-title"
              label="Título / atalho"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Horário"
              required
            />
            <label className="block text-sm">
              <span className="text-app-muted">Mensagem</span>
              <textarea
                ref={bodyRef}
                value={form.body}
                onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                className="mt-1 min-h-[100px] w-full rounded-xl border border-app-border bg-app-secondary px-3 py-2 text-sm"
                placeholder="Olá {primeiro_nome}, nosso horário é 8h às 18h."
                required
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-app-subtle">Inserir variável:</span>
              {VARIABLE_CHIPS.map((chip) => (
                <button
                  key={chip.token}
                  type="button"
                  onClick={() => insertVariable(chip.token)}
                  className="rounded-full border border-app-border bg-app-secondary/60 px-3 py-1 text-xs font-medium text-app-text transition-colors hover:border-app-accent/50 hover:bg-app-accent/10"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            {form.body.trim() && (
              <p className="text-xs text-app-subtle">
                Prévia:{" "}
                <span className="text-app-muted">
                  {applyQuickReplyVariables(form.body, PREVIEW_VARS)}
                </span>
              </p>
            )}
            {canManageCompany && (
              <Select
                id="qr-scope"
                label="Escopo"
                value={form.scope}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    scope: e.target.value as "company" | "personal",
                  }))
                }
              >
                <option value="company">Empresa (todos os atendentes)</option>
                <option value="personal">Pessoal (só você)</option>
              </Select>
            )}
            <Button type="submit" loading={saving}>
              Adicionar resposta rápida
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Cadastradas</h2>
          {loading ? (
            <p className="mt-3 text-sm text-app-subtle">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm text-app-subtle">Nenhuma resposta rápida.</p>
          ) : (
            <ul className="mt-3 divide-y divide-app-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-app-muted">{item.body}</p>
                    <p className="mt-1 text-[0.6875rem] text-app-subtle">
                      {item.scope === "company" ? "Empresa" : "Pessoal"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 text-red-300"
                  >
                    Excluir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
