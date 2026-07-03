"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Download, Pause, Play, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/layout/AppShell";
import { CampaignKpiRow } from "@/components/campaigns/CampaignKpiRow";
import { CampaignRecipientsTable } from "@/components/campaigns/CampaignRecipientsTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { appAlert } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { describeAudienceType, describeExcludeRecentDays } from "@/lib/campaign-audience-labels";
import { formatDispatchModeLabel } from "@/lib/campaign-cadence";
import { formatParameterMappingLabel } from "@/lib/campaign-params";
import { campaignStatusLabel, tsToDate } from "@/lib/campaign-stats";
import type { Campaign, CampaignJob, ContactList, ContactOrigin, Template } from "@/lib/types";

function shouldPollCampaign(campaign: Campaign): boolean {
  if (campaign.status === "running") return true;
  if (campaign.status !== "finished") return false;
  const updatedAt = tsToDate(campaign.updatedAt);
  if (!updatedAt) return false;
  const hoursSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSince < 24;
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [jobs, setJobs] = useState<CampaignJob[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [list, setList] = useState<ContactList | null>(null);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [originFieldLabels, setOriginFieldLabels] = useState<Record<string, string>>({});
  const [headerImagePreview, setHeaderImagePreview] = useState<{
    previewUrl?: string;
    name?: string;
    mode?: string;
    mapping?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const [lastJobsRefresh, setLastJobsRefresh] = useState<Date | null>(null);
  const [jobsRefreshTick, setJobsRefreshTick] = useState(0);

  const loadJobs = useCallback(async () => {
    const res = await apiFetch(`/api/campaigns/${id}/jobs?sync=true`);
    const jobsData = await parseApiJson<{ jobs?: CampaignJob[] }>(res);
    if (res.ok) {
      setJobs(jobsData.jobs || []);
      setLastJobsRefresh(new Date());
    }
  }, [id]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [campRes, jobsRes, templatesRes, listsRes, originsRes] = await Promise.all([
        apiFetch(`/api/campaigns/${id}`),
        apiFetch(`/api/campaigns/${id}/jobs?sync=true`),
        apiFetch("/api/templates"),
        apiFetch("/api/contact-lists"),
        apiFetch("/api/contact-origins"),
      ]);

      const campData = await parseApiJson<{ campaign?: Campaign; error?: string }>(campRes);
      const jobsData = await parseApiJson<{ jobs?: CampaignJob[] }>(jobsRes);
      const templatesData = await parseApiJson<{ templates?: Template[] }>(templatesRes);
      const listsData = await parseApiJson<{ lists?: ContactList[] }>(listsRes);
      const originsData = await parseApiJson<{ origins?: ContactOrigin[] }>(originsRes);

      if (!campRes.ok || !campData.campaign) {
        throw new Error(campData.error || "Campanha não encontrada.");
      }

      setCampaign(campData.campaign);
      setJobs(jobsData.jobs || []);
      setLastJobsRefresh(new Date());
      setTemplate(
        (templatesData.templates || []).find(
          (t) => t.name === campData.campaign!.templateName
        ) || null
      );
      const listId =
        campData.campaign.contactListId ||
        campData.campaign.audienceConfig?.contactListId;
      if (listId) {
        setList((listsData.lists || []).find((l) => l.id === listId) || null);
      } else {
        setList(null);
      }

      const originId =
        campData.campaign.contactOriginId ||
        campData.campaign.audienceConfig?.originId;
      const matchedOrigin = (originsData.origins || []).find((o) => o.id === originId);
      setOriginLabel(matchedOrigin?.label ?? null);
      setOriginFieldLabels(
        Object.fromEntries(
          (matchedOrigin?.fields || []).map((f) => [f.key, f.label])
        )
      );

      const camp = campData.campaign;
      if (
        camp?.headerImageAssetId ||
        camp?.headerImageStoragePath ||
        camp?.headerImageMapping
      ) {
        apiFetch("/api/media-library")
          .then((res) =>
            parseApiJson<{
              assets?: Array<{ id: string; name: string; previewUrl?: string }>;
            }>(res)
          )
          .then((lib) => {
            const asset = (lib.assets || []).find(
              (a) => a.id === camp.headerImageAssetId
            );
            setHeaderImagePreview({
              previewUrl: asset?.previewUrl,
              name: asset?.name,
              mode: camp.headerImageMode || "fixed",
              mapping: camp.headerImageMapping,
            });
          })
          .catch(() => {
            setHeaderImagePreview({
              mode: camp.headerImageMode || "fixed",
              mapping: camp.headerImageMapping,
            });
          });
      } else {
        setHeaderImagePreview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when id changes
  }, [id]);

  useEffect(() => {
    if (!campaign || !shouldPollCampaign(campaign)) return;

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void loadJobs();
    }, 8000);

    return () => window.clearInterval(interval);
  }, [campaign, loadJobs]);

  useEffect(() => {
    if (!lastJobsRefresh) return;
    const timer = window.setInterval(() => setJobsRefreshTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [lastJobsRefresh]);

  const jobsRefreshLabel = useMemo(() => {
    void jobsRefreshTick;
    if (!lastJobsRefresh) return null;
    return formatDistanceToNow(lastJobsRefresh, { addSuffix: true, locale: ptBR });
  }, [lastJobsRefresh, jobsRefreshTick]);

  async function runAction(action: string) {
    setActing(true);
    try {
      const res = await apiFetch(`/api/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao executar ação.");
      await load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setActing(false);
    }
  }

  function exportFailedJobs() {
    const failed = jobs.filter((j) => j.status === "failed");
    if (failed.length === 0) {
      void appAlert("Nenhuma falha para exportar.", { title: "Exportar falhas" });
      return;
    }
    const rows = [
      ["Nome", "Telefone", "Erro", "Tentativas"],
      ...failed.map((j) => [
        j.contactName || "",
        j.phone,
        j.lastError || "",
        String(j.attempts),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Falhas");
    XLSX.writeFile(wb, `campanha-falhas-${campaign?.name || id}.xlsx`);
  }

  const statusTone = useMemo(() => {
    if (!campaign) return "neutral" as const;
    if (campaign.status === "running") return "info" as const;
    if (campaign.status === "finished") return "success" as const;
    if (campaign.status === "paused") return "warning" as const;
    return "neutral" as const;
  }, [campaign]);

  const cadenceProgress = useMemo(() => {
    if (!campaign || campaign.dispatchMode !== "cadence") return null;
    const pending = jobs.filter((j) => j.status === "pending");
    if (jobs.length === 0) return null;
    const done = jobs.length - pending.length;
    return Math.round((done / jobs.length) * 100);
  }, [campaign, jobs]);

  if (loading) {
    return (
      <AppShell title="Campanha" subtitle="Carregando detalhes...">
        <p className="text-app-subtle">Carregando...</p>
      </AppShell>
    );
  }

  if (!campaign || error) {
    return (
      <AppShell title="Campanha" subtitle="Detalhes">
        <Card>
          <p className="text-red-400">{error || "Campanha não encontrada."}</p>
          <Button className="mt-4" variant="secondary" onClick={() => router.push("/campaigns")}>
            Voltar
          </Button>
        </Card>
      </AppShell>
    );
  }

  const createdAt = tsToDate(campaign.createdAt);
  const updatedAt = tsToDate(campaign.updatedAt);
  const scheduledAt = tsToDate(campaign.scheduledAt);
  const scheduledEndAt = tsToDate(campaign.scheduledEndAt);

  const audienceLabel =
    list?.name ||
    describeAudienceType(campaign.audienceType, campaign.audienceConfig, originLabel ?? undefined);
  const excludeRecentLabel = describeExcludeRecentDays(campaign.excludeRecentDays);

  return (
    <AppShell
      title={campaign.name}
      subtitle={
        campaign.status === "finished" && updatedAt
          ? `Concluída ${formatDistanceToNow(updatedAt, { addSuffix: true, locale: ptBR })}`
          : `Template ${campaign.templateName}`
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1.5 text-sm text-app-muted hover:text-app-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Campanhas
          </Link>
          <span className="text-app-muted">/</span>
          <span className="text-sm text-app-subtle">Detalhes</span>
          <Badge tone={statusTone}>{campaignStatusLabel(campaign.status)}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {jobsRefreshLabel && (
            <span className="self-center text-xs text-app-muted">
              Atualizado {jobsRefreshLabel}
            </span>
          )}
          <Button type="button" variant="secondary" onClick={() => load()} disabled={acting}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Atualizar
          </Button>
          {jobs.some((j) => j.status === "failed") && (
            <Button type="button" variant="secondary" onClick={exportFailedJobs}>
              <Download className="mr-1.5 h-4 w-4" />
              Exportar falhas
            </Button>
          )}
          {campaign.status === "draft" && (
            <Button type="button" loading={acting} onClick={() => runAction("start")}>
              <Play className="mr-1.5 h-4 w-4" />
              Iniciar
            </Button>
          )}
          {campaign.status === "running" && (
            <>
              <Button
                type="button"
                variant="secondary"
                loading={acting}
                onClick={() => runAction("run")}
              >
                Processar lote
              </Button>
              <Button type="button" variant="danger" loading={acting} onClick={() => runAction("pause")}>
                <Pause className="mr-1.5 h-4 w-4" />
                Pausar
              </Button>
            </>
          )}
          {campaign.status === "paused" && (
            <Button type="button" loading={acting} onClick={() => runAction("start")}>
              Retomar
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <CampaignKpiRow
          campaign={campaign}
          jobs={jobs}
          templateCategory={template?.category}
        />
      </div>

      {cadenceProgress !== null && campaign.status === "running" && (
        <Card hover={false} className="mb-6">
          <p className="mb-2 text-sm text-app-subtle">Progresso da cadência</p>
          <div className="h-2 overflow-hidden rounded-full bg-app-secondary">
            <div
              className="h-full bg-app-accent transition-all"
              style={{ width: `${cadenceProgress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-app-muted">{cadenceProgress}% dos jobs processados</p>
        </Card>
      )}

      <Card hover={false} className="mb-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Informações da campanha</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="Template" value={campaign.templateName} />
          <InfoField
            label="Categoria"
            value={template?.category || "—"}
            badge={template?.category === "MARKETING" ? "Marketing" : undefined}
          />
          <InfoField label="Idioma" value={campaign.templateLanguage || "pt_BR"} />
          <InfoField label="Audiência" value={audienceLabel} />
          {excludeRecentLabel && (
            <InfoField label="Exclusão recente" value={excludeRecentLabel} />
          )}
          {originLabel && (
            <InfoField label="Origem da campanha" value={originLabel} />
          )}
          <InfoField label="Modo de disparo" value={formatDispatchModeLabel(campaign.dispatchMode, campaign.cadenceConfig)} />
          <InfoField label="Destinatários" value={`${campaign.totalContacts} contatos`} />
          <InfoField label="Lote por execução" value={String(campaign.maxSendsPerRun || 20)} />
          {campaign.dailySendLimit && (
            <InfoField label="Limite diário" value={String(campaign.dailySendLimit)} />
          )}
          <InfoField
            label="Criada em"
            value={createdAt ? createdAt.toLocaleString("pt-BR") : "—"}
          />
          {scheduledAt && (
            <InfoField
              label="Agendada para"
              value={scheduledAt.toLocaleString("pt-BR")}
            />
          )}
          {scheduledEndAt && (
            <InfoField
              label="Término agendado"
              value={scheduledEndAt.toLocaleString("pt-BR")}
            />
          )}
          {campaign.quietHours?.enabled && (
            <InfoField
              label="Horário comercial"
              value={`Não enviar ${campaign.quietHours.start}–${campaign.quietHours.end}`}
            />
          )}
          {updatedAt && campaign.status !== "draft" && (
            <InfoField
              label="Última atualização"
              value={updatedAt.toLocaleString("pt-BR")}
            />
          )}
        </div>

        {campaign.importStats && (
          <div className="mt-4 rounded-xl border border-app-border bg-app-secondary/30 p-4 text-sm text-app-subtle">
            <p className="mb-1 font-medium text-app-text">Importação da planilha</p>
            <p>
              {campaign.importStats.total} linhas · {campaign.importStats.imported} importados ·{" "}
              {campaign.importStats.updated || 0} atualizados · {campaign.importStats.skipped}{" "}
              ignorados · {campaign.importStats.invalid} inválidos
            </p>
          </div>
        )}

        {template?.header?.type === "IMAGE" && (
          <div className="mt-5 rounded-xl border border-app-border bg-app-secondary/30 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">
              Imagem do cabeçalho
            </p>
            {headerImagePreview?.mode === "per_contact" && headerImagePreview.mapping ? (
              <p className="text-sm text-app-subtle">
                Por contato:{" "}
                <span className="font-medium text-app-text">
                  {headerImagePreview.mapping.startsWith("origin:")
                    ? originFieldLabels[headerImagePreview.mapping.slice(7)] ||
                      headerImagePreview.mapping
                    : headerImagePreview.mapping}
                </span>
              </p>
            ) : headerImagePreview?.previewUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={headerImagePreview.previewUrl}
                  alt={headerImagePreview.name || "Cabeçalho"}
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <p className="text-sm text-app-text">
                  {headerImagePreview.name || "Imagem fixa"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-app-muted">Nenhuma imagem configurada.</p>
            )}
          </div>
        )}

        {template && (
          <div className="mt-5 rounded-xl border border-app-border bg-app-secondary/30 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">
              Parâmetros do template
            </p>
            <p className="text-sm text-app-subtle">
              <span className="font-medium text-app-text">BODY:</span> {template.body}
            </p>
            {campaign.parameterMapping && campaign.parameterMapping.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-app-muted">
                {campaign.parameterMapping.map((m, i) => (
                  <li key={i}>
                    {`{{${i + 1}}}`}: {formatParameterMappingLabel(m, originFieldLabels)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <CampaignRecipientsTable jobs={jobs} />
    </AppShell>
  );
}

function InfoField({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-app-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-app-text">
        {value}
        {badge && (
          <span className="ml-2 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300">
            {badge}
          </span>
        )}
      </p>
    </div>
  );
}
