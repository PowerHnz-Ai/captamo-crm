"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { ContactList } from "@/lib/types";

export default function ContactListsSettingsPage() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    tagFilter: "",
  });

  function load() {
    setLoading(true);
    apiFetch("/api/contact-lists")
      .then((res) => parseApiJson<{ lists?: ContactList[]; error?: string }>(res))
      .then((data) => {
        if (!data.lists) throw new Error(data.error || "Erro ao carregar listas.");
        setLists(data.lists);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const tagFilter = form.tagFilter
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await apiFetch("/api/contact-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          tagFilter: tagFilter.length ? tagFilter : undefined,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao criar lista.");
      setForm({ name: "", description: "", tagFilter: "" });
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function removeList(id: string) {
    const confirmed = await appConfirm("Excluir esta lista?", {
      title: "Excluir lista",
      destructive: true,
      confirmLabel: "Excluir",
    });
    if (!confirmed) return;
    const res = await apiFetch(`/api/contact-lists/${id}`, { method: "DELETE" });
    const data = await parseApiJson<{ error?: string }>(res);
    if (!res.ok) {
      await appAlert(data.error || "Erro ao excluir.", { title: "Erro", variant: "error" });
      return;
    }
    load();
  }

  return (
    <AppShell
      title="Listas de contatos"
      subtitle="Segmentos para campanhas e disparos em lote"
    >
      <Card hover={false} className="mb-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Nova lista</h3>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
          <Input
            id="list-name"
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            id="list-desc"
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            id="list-tags"
            label="Filtrar por tags (vírgula)"
            value={form.tagFilter}
            onChange={(e) => setForm({ ...form, tagFilter: e.target.value })}
            placeholder="vip, retorno"
            className="md:col-span-2"
          />
          <div className="md:col-span-2">
            <Button type="submit" loading={creating}>
              Criar lista
            </Button>
          </div>
        </form>
      </Card>

      <Card hover={false}>
        <h3 className="mb-4 font-display text-lg font-semibold">Listas cadastradas</h3>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {loading ? (
          <p className="text-app-subtle">Carregando...</p>
        ) : lists.length === 0 ? (
          <p className="text-app-subtle">Nenhuma lista criada.</p>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => (
              <div
                key={list.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-app-border bg-app-secondary/30 p-4"
              >
                <div>
                  <p className="font-medium">{list.name}</p>
                  {list.description && (
                    <p className="text-sm text-app-muted">{list.description}</p>
                  )}
                  {list.tagFilter?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {list.tagFilter.map((tag) => (
                        <Badge key={tag} tone="info">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-app-muted">
                      Todos que autorizaram campanhas
                    </p>
                  )}
                </div>
                <Button type="button" variant="danger" onClick={() => removeList(list.id)}>
                  Excluir
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
