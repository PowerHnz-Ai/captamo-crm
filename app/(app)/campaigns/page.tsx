"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { CampaignCreateModal } from "@/components/campaigns/CampaignCreateModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { Campaign, CampaignJob, ContactList, Template } from "@/lib/types";

type StatusFilter = "all" | Campaign["status"];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [limits, setLimits] = useState<{
    sentToday: number;
    dailyCap: number;
    remaining: number;
    tier: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobsByCampaign, setJobsByCampaign] = useState<Record<string, CampaignJob[]>>({});
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  async function loadJobsForCampaigns(campaignList: Campaign[]) {
    const active = campaignList.filter(
      (c) => c.status !== "draft" || c.sentCount > 0
    );
    if (!active.length) {
      setJobsByCampaign({});
      return;
    }

    const entries = await Promise.all(
      active.map(async (campaign) => {
        const sync = campaign.status === "running" ? "?sync=true" : "";
        const res = await apiFetch(`/api/campaigns/${campaign.id}/jobs${sync}`);
        const data = await parseApiJson<{ jobs?: CampaignJob[] }>(res);
        return [campaign.id, data.jobs || []] as const;
      })
    );
    setJobsByCampaign(Object.fromEntries(entries));
  }

  const loadJobsForRunning = useCallback(async () => {
    const running = campaigns.filter((c) => c.status === "running");
    if (!running.length) return;
    const entries = await Promise.all(
      running.map(async (campaign) => {
        const res = await apiFetch(`/api/campaigns/${campaign.id}/jobs?sync=true`);
        const data = await parseApiJson<{ jobs?: CampaignJob[] }>(res);
        return [campaign.id, data.jobs || []] as const;
      })
    );
    setJobsByCampaign((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, [campaigns]);

  function load() {
    setLoading(true);
    setLoadError("");
    Promise.all([
      apiFetch("/api/campaigns").then((r) =>
        parseApiJson<{ campaigns?: Campaign[] }>(r)
      ),
      apiFetch("/api/contact-lists").then((r) =>
        parseApiJson<{ lists?: ContactList[] }>(r)
      ),
      apiFetch("/api/reports/overview?days=1").then((r) =>
        parseApiJson<{
          limits?: {
            sentToday: number;
            dailyCap: number;
            remaining: number;
            tier: number;
          };
        }>(r)
      ),
      apiFetch("/api/templates").then((r) =>
        parseApiJson<{ templates?: Template[] }>(r)
      ),
    ])
      .then(([campData, listData, reportData, templateData]) => {
        const nextCampaigns = campData.campaigns || [];
        setCampaigns(nextCampaigns);
        setLists(listData.lists || []);
        setLimits(reportData.limits || null);
        setTemplates(templateData.templates || []);
        void loadJobsForCampaigns(nextCampaigns);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const hasRunning = campaigns.some((c) => c.status === "running");
    if (!hasRunning) return;

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void loadJobsForRunning();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [campaigns, loadJobsForRunning]);

  async function runAction(id: string, action: "start" | "pause" | "run") {
    try {
      const res = await apiFetch(`/api/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao executar ação.");
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao executar ação.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  async function duplicateCampaign(id: string) {
    try {
      const res = await apiFetch(`/api/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao duplicar campanha.");
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao duplicar campanha.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    const confirmed = await appConfirm(
      `Excluir a campanha "${campaign.name}"? Esta ação não pode ser desfeita.`,
      {
        title: "Excluir campanha",
        destructive: true,
        confirmLabel: "Excluir",
      }
    );
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/api/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao excluir campanha.");
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao excluir campanha.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.templateName.toLowerCase().includes(q)
      );
    });
  }, [campaigns, search, statusFilter]);

  return (
    <AppShell
      title="Campanhas"
      subtitle="Envie mensagens em massa para seus contatos via WhatsApp"
    >
      {limits && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-secondary/30 px-4 py-3 text-sm text-app-subtle">
          <span>
            Hoje: <strong className="text-app-text">{limits.sentToday}</strong> de{" "}
            <strong className="text-app-text">{limits.dailyCap}</strong> disparos ·
            Restante: <strong className="text-app-text">{limits.remaining}</strong>
          </span>
          <span className="text-app-muted">Tier Meta: {limits.tier}</span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar campanhas..."
            className="w-full rounded-xl border border-app-border bg-app-secondary/50 py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="w-auto"
        >
          <option value="all">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="running">Em execução</option>
          <option value="paused">Pausada</option>
          <option value="finished">Concluída</option>
        </Select>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova campanha
        </Button>
      </div>

      {loadError && <p className="mb-4 text-sm text-red-400">{loadError}</p>}

      {loading ? (
        <p className="text-app-subtle">Carregando campanhas...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-app-subtle">
            {campaigns.length === 0
              ? "Nenhuma campanha criada ainda."
              : "Nenhuma campanha corresponde aos filtros."}
          </p>
          {campaigns.length === 0 && (
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              Criar primeira campanha
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              jobs={jobsByCampaign[campaign.id]}
              onAction={(action) => runAction(campaign.id, action)}
              onEdit={() => setEditingCampaign(campaign)}
              onDuplicate={() => duplicateCampaign(campaign.id)}
              onDelete={() => deleteCampaign(campaign)}
            />
          ))}
        </div>
      )}

      <CampaignCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        lists={lists}
        templates={templates}
      />

      <CampaignCreateModal
        open={Boolean(editingCampaign)}
        editing={editingCampaign}
        onClose={() => setEditingCampaign(null)}
        onCreated={load}
        lists={lists}
        templates={templates}
      />
    </AppShell>
  );
}
