"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TemplateBuilder } from "@/components/templates/TemplateBuilder";
import { appAlert } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { templateCategoryLabel, templateStatusLabel } from "@/lib/template-labels";
import type { Template } from "@/lib/types";

type Tab = "draft" | "pending" | "approved";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("approved");
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [syncHint, setSyncHint] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);

  const fetchTemplates = useCallback(async () => {
    const res = await apiFetch("/api/templates");
    const data = await parseApiJson<{ templates?: Template[]; error?: string }>(res);
    if (!res.ok) {
      throw new Error(data.error || "Erro ao carregar templates.");
    }
    return data.templates || [];
  }, []);

  const syncFromMeta = useCallback(async () => {
    const res = await apiFetch("/api/templates/sync", { method: "POST" });
    const data = await parseApiJson<{
      error?: string;
      synced?: number;
      fetched?: number;
      approved?: number;
    }>(res);

    if (!res.ok) {
      throw new Error(data.error || "Erro ao sincronizar com a Meta.");
    }

    return data;
  }, []);

  function loadTemplates() {
    setLoading(true);
    setLoadError("");
    fetchTemplates()
      .then(setTemplates)
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      setLoadError("");
      setSyncHint("");

      try {
        let items = await fetchTemplates();
        if (!active) return;

        setSyncing(true);
        setSyncHint("Importando templates da Meta...");

        try {
          const syncResult = await syncFromMeta();
          if (!active) return;

          if ((syncResult.fetched ?? 0) > 0) {
            items = await fetchTemplates();
            setSyncHint(
              `${syncResult.synced ?? 0} template(s) sincronizado(s) — ${syncResult.approved ?? 0} aprovado(s) na Meta.`
            );
          } else {
            setSyncHint(
              "Nenhum template encontrado na Meta para esta conta WABA. Verifique META_WABA_ID no .env.local."
            );
          }
        } catch (syncErr) {
          if (!active) return;
          const message =
            syncErr instanceof Error ? syncErr.message : "Erro ao sincronizar.";
          setSyncHint(
            `Não foi possível importar da Meta: ${message} Clique em "Sincronizar Meta" para tentar de novo.`
          );
        } finally {
          if (active) setSyncing(false);
        }

        if (active) setTemplates(items);
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : "Erro ao carregar.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [fetchTemplates, syncFromMeta]);

  const filtered = templates.filter((t) => {
    if (tab === "draft") return t.status === "draft";
    if (tab === "pending")
      return t.status === "pending" || t.status === "submitted";
    return t.status === "approved";
  });

  function handleSaved() {
    setEditingTemplate(null);
    loadTemplates();
  }

  function handleEdit(template: Template) {
    setEditingTemplate(template);
    requestAnimationFrame(() => {
      builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleSubmit(id: string) {
    const res = await apiFetch(`/api/templates/${id}/submit`, { method: "POST" });
    const data = await parseApiJson<{ error?: string }>(res);
    if (!res.ok) {
      await appAlert(data.error || "Erro ao submeter", { title: "Erro", variant: "error" });
    }
    loadTemplates();
  }

  async function handleSync() {
    setSyncing(true);
    setSyncHint("");
    setLoadError("");
    try {
      const syncResult = await syncFromMeta();
      const items = await fetchTemplates();
      setTemplates(items);
      setSyncHint(
        `${syncResult.synced ?? 0} template(s) sincronizado(s) — ${syncResult.approved ?? 0} aprovado(s).`
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "draft", label: "Novo Template" },
    { id: "pending", label: "Enviados à Meta" },
    { id: "approved", label: "Aprovados" },
  ];

  return (
    <AppShell
      title="Templates"
      subtitle="Crie, envie para aprovação na Meta e sincronize status"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-app-accent/15 text-app-accent"
                : "text-app-subtle hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
        <Button variant="secondary" onClick={handleSync} loading={syncing}>
          Sincronizar Meta
        </Button>
      </div>

      {syncHint && (
        <p className="mb-4 text-sm text-app-muted">{syncHint}</p>
      )}
      {loadError && (
        <p className="mb-4 text-sm text-red-400">{loadError}</p>
      )}

      {tab === "draft" && (
        <div ref={builderRef} className="mb-6">
          <TemplateBuilder
            editing={editingTemplate}
            onCreated={handleSaved}
            onCancelEdit={() => setEditingTemplate(null)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-app-subtle">
          {syncing ? "Sincronizando templates com a Meta..." : "Carregando templates..."}
        </p>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-app-subtle">
            Nenhum template nesta aba.
            {tab === "approved" &&
              " Templates criados direto no Gerenciador da Meta aparecem aqui após sincronizar."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((template) => (
            <Card key={template.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">{template.name}</h3>
                  <p className="mt-1 text-sm text-app-muted">
                    Idioma: {template.language} · Categoria:{" "}
                    {templateCategoryLabel(template.category)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      template.status === "approved"
                        ? "success"
                        : template.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {templateStatusLabel(template.status)}
                  </Badge>
                  {template.status === "draft" && (
                    <>
                      <Button variant="secondary" onClick={() => handleEdit(template)}>
                        Editar
                      </Button>
                      <Button variant="secondary" onClick={() => handleSubmit(template.id)}>
                        Enviar à Meta
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-4 rounded-xl border border-app-border bg-app-secondary/50 p-4 text-sm leading-relaxed text-app-subtle">
                {template.body}
              </p>
              {template.rejectionReason && (
                <p className="mt-2 text-sm text-red-400">
                  Motivo rejeição: {template.rejectionReason}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
