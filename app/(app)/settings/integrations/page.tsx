"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { usePermissions } from "@/hooks/usePermissions";
import { appAlert } from "@/lib/app-dialog";
import { apiFetch } from "@/lib/api-fetch";

const PROVIDERS = [
  { id: "meta_cloud", label: "Meta Cloud API (oficial)" },
  { id: "evolution", label: "Evolution API" },
] as const;

interface WebhookSetup {
  verifyTokenConfigured: boolean;
  subscribeFields: string[];
  callbackUrl: string;
  productionUrlReady: boolean;
  localhostWarning: boolean;
  reachability?: {
    ok: boolean;
    status?: number;
    message: string;
    bodyPreview?: string;
  };
}

interface EnvStatus {
  metaToken: boolean;
  metaPhoneNumberId: boolean;
  whatsappVerifyToken: boolean;
  crmDefaultCompanyId: boolean;
  firebaseAdmin: boolean;
  appUrl: string;
}

interface WebhookEventRow {
  id: string;
  provider: string;
  eventType: string;
  phone?: string;
  status: string;
  error?: string;
  eventCount?: number;
  createdAt?: number;
}

export default function IntegrationsPage() {
  const { can } = usePermissions();
  const canView = can("integrations.view");
  const canManage = can("integrations.manage");
  const [config, setConfig] = useState({
    provider: "meta_cloud",
    phoneNumberId: "",
    wabaId: "",
    instanceId: "",
    dailyCap: 1000,
    baseUrl: "",
  });
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [webhookSetup, setWebhookSetup] = useState<WebhookSetup | null>(null);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [recentWebhookEvents, setRecentWebhookEvents] = useState<WebhookEventRow[]>([]);
  const [limits, setLimits] = useState<{
    sentToday: number;
    dailyCap: number;
    remaining: number;
    provider: string;
  } | null>(null);
  const [testResult, setTestResult] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    apiFetch("/api/settings/integrations")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          const provider =
            data.config.provider === "wasender" ? "evolution" : data.config.provider;
          setConfig((c) => ({ ...c, ...data.config, provider }));
        }
        if (data.webhooks) setWebhooks(data.webhooks);
        if (data.webhookSetup) setWebhookSetup(data.webhookSetup);
        if (data.envStatus) setEnvStatus(data.envStatus);
        if (data.recentWebhookEvents) setRecentWebhookEvents(data.recentWebhookEvents);
        if (data.limits) setLimits(data.limits);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView]);

  if (!canView) {
    return (
      <AppShell title="Integrações" subtitle="Configuração WhatsApp">
        <p className="text-app-subtle">Apenas administradores podem acessar integrações.</p>
      </AppShell>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await apiFetch("/api/settings/integrations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    if (res.ok) load();
    else {
      const data = await res.json();
      await appAlert(data.error || "Erro ao salvar", { title: "Erro", variant: "error" });
    }
  }

  async function handleTest() {
    setTestResult("Testando...");
    const res = await apiFetch("/api/settings/integrations", { method: "POST" });
    const data = await res.json();
    setTestResult(data.ok ? data.message : `Falha: ${data.message}`);
  }

  async function copyWebhookUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback("URL copiada!");
      setTimeout(() => setCopyFeedback(""), 2000);
    } catch {
      setCopyFeedback("Não foi possível copiar.");
    }
  }

  function envLabel(ok: boolean) {
    return ok ? (
      <Badge tone="success">OK</Badge>
    ) : (
      <Badge tone="warning">Ausente</Badge>
    );
  }

  function formatEventTime(row: WebhookEventRow) {
    if (!row.createdAt) return "—";
    return new Date(row.createdAt).toLocaleString("pt-BR");
  }

  if (loading) {
    return (
      <AppShell title="Integrações" subtitle="Configuração WhatsApp">
        <p className="text-app-subtle">Carregando...</p>
      </AppShell>
    );
  }

  const activeWebhookUrl =
    webhookSetup?.callbackUrl || webhooks.meta || "";

  return (
    <AppShell
      title="Integrações"
      subtitle="Provedor WhatsApp, webhooks e limites de disparo"
    >
      {webhookSetup?.reachability && !webhookSetup.reachability.ok && (
        <Card hover={false} className="mb-6 border-red-500/40 bg-red-500/10">
          <h3 className="font-semibold text-red-200">Webhook inacessível para a Meta</h3>
          <p className="mt-2 text-sm text-red-100/90">{webhookSetup.reachability.message}</p>
          <p className="mt-2 text-xs text-red-200/80">
            URL testada: <code className="rounded bg-black/30 px-1">{activeWebhookUrl}</code>
            {webhookSetup.reachability.status != null && (
              <> · HTTP {webhookSetup.reachability.status}</>
            )}
          </p>
          <p className="mt-3 text-sm text-red-100/90">
            <strong>Causa provável:</strong> <code className="rounded bg-black/30 px-1">app.misterodonto.com.br</code>{" "}
            hoje serve o Task Checklist, não o CRM Captamo. A Meta precisa de uma URL onde o Next.js do CRM
            esteja em produção (ex.: subdomínio <code className="rounded bg-black/30 px-1">crm.misterodonto.com.br</code>{" "}
            ou deploy do CRM no mesmo domínio).
          </p>
        </Card>
      )}

      {webhookSetup?.reachability?.ok && (
        <Card hover={false} className="mb-6 border-emerald-500/30 bg-emerald-500/10">
          <p className="text-sm text-emerald-100">{webhookSetup.reachability.message}</p>
        </Card>
      )}

      {webhookSetup?.localhostWarning && (
        <Card hover={false} className="mb-6 border-amber-500/30 bg-amber-500/10">
          <h3 className="font-semibold text-amber-200">Mensagens inbound não chegam em localhost</h3>
          <p className="mt-2 text-sm text-amber-100/90">
            A Meta só envia webhooks para URLs HTTPS públicas. Configure o webhook em produção (
            {envStatus?.appUrl || "APP_URL"}) ou use um túnel (ngrok). O CRM em localhost lê o
            mesmo Firestore — após configurar o webhook em produção, as mensagens aparecem ao
            atualizar o inbox.
          </p>
        </Card>
      )}

      {limits && (
        <Card hover={false} className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="info">{limits.provider}</Badge>
            <span className="text-sm text-app-subtle">
              {limits.sentToday}/{limits.dailyCap} disparos hoje · Restante: {limits.remaining}
            </span>
          </div>
        </Card>
      )}

      <Card hover={false} className="mb-6">
        <h3 className="mb-4 font-display text-lg font-semibold">
          Configurar webhook na Meta (obrigatório para receber mensagens)
        </h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-app-subtle">
          <li>
            Acesse{" "}
            <a
              href="https://developers.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-app-accent hover:underline"
            >
              developers.facebook.com
            </a>{" "}
            → seu app → WhatsApp → Configuration
          </li>
          <li>
            Callback URL:{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">{activeWebhookUrl}</code>
          </li>
          <li>
            Verify token: valor de <code className="rounded bg-black/30 px-1">WHATSAPP_VERIFY_TOKEN</code>{" "}
            no servidor {webhookSetup?.verifyTokenConfigured ? "(configurado)" : "(não configurado)"}
          </li>
          <li>Assine o campo <strong>messages</strong></li>
          <li>Envie uma mensagem do celular para o número da API e verifique os eventos abaixo</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => copyWebhookUrl(activeWebhookUrl)}
          >
            Copiar URL do webhook
          </Button>
          {copyFeedback && <span className="text-sm text-app-muted">{copyFeedback}</span>}
        </div>
      </Card>

      {envStatus && (
        <Card hover={false} className="mb-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Variáveis do servidor</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2">
              <span>META_WHATSAPP_TOKEN</span>
              {envLabel(envStatus.metaToken)}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2">
              <span>META_PHONE_NUMBER_ID</span>
              {envLabel(envStatus.metaPhoneNumberId)}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2">
              <span>WHATSAPP_VERIFY_TOKEN</span>
              {envLabel(envStatus.whatsappVerifyToken)}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2">
              <span>CRM_DEFAULT_COMPANY_ID</span>
              {envLabel(envStatus.crmDefaultCompanyId)}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2">
              <span>Firebase Admin</span>
              {envLabel(envStatus.firebaseAdmin)}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2">
              <span>APP_URL</span>
              <span className="truncate text-xs text-app-muted">{envStatus.appUrl}</span>
            </div>
          </div>
        </Card>
      )}

      <Card hover={false} className="mb-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Provedor ativo</h3>
        <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Select
              id="provider"
              label="Provedor"
              value={config.provider}
              onChange={(e) => setConfig({ ...config, provider: e.target.value })}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {config.provider === "meta_cloud" && (
            <>
              <Input
                id="phoneNumberId"
                label="Phone Number ID"
                value={config.phoneNumberId}
                onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
              />
              <Input
                id="wabaId"
                label="WABA ID"
                value={config.wabaId}
                onChange={(e) => setConfig({ ...config, wabaId: e.target.value })}
              />
            </>
          )}

          {config.provider === "evolution" && (
            <>
              <Input
                id="instanceId"
                label="Instance ID"
                value={config.instanceId}
                onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
              />
              <Input
                id="baseUrl"
                label="Base URL da API"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              />
            </>
          )}

          <Input
            id="dailyCap"
            label="Limite diário operacional"
            type="number"
            value={String(config.dailyCap)}
            onChange={(e) => setConfig({ ...config, dailyCap: Number(e.target.value) })}
          />

          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" loading={saving} disabled={!canManage}>
              Salvar configuração
            </Button>
            <Button type="button" variant="secondary" onClick={handleTest}>
              Testar conexão
            </Button>
          </div>
          {testResult && (
            <p className="text-sm text-app-subtle md:col-span-2">{testResult}</p>
          )}
        </form>
      </Card>

      <Card hover={false} className="mb-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Eventos de webhook recentes</h3>
        {recentWebhookEvents.length === 0 ? (
          <p className="text-sm text-app-subtle">
            Nenhum evento recebido ainda. Após configurar o webhook na Meta, envie uma mensagem de
            teste do celular.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-app-border text-app-muted">
                  <th className="py-2 pr-3">Quando</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Telefone</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentWebhookEvents.map((row) => (
                  <tr key={row.id} className="border-b border-app-border/50">
                    <td className="py-2 pr-3 text-xs text-app-muted">
                      {formatEventTime(row)}
                    </td>
                    <td className="py-2 pr-3">{row.eventType}</td>
                    <td className="py-2 pr-3">{row.phone || "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        tone={
                          row.status === "processed"
                            ? "success"
                            : row.status === "error"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {row.status}
                      </Badge>
                      {row.error && (
                        <p className="mt-1 text-xs text-red-300">{row.error}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card hover={false}>
        <h3 className="mb-4 font-display text-lg font-semibold">URLs de webhook</h3>
        <div className="space-y-2 text-sm">
          {Object.entries(webhooks)
            .filter(([key]) => key !== "wasender")
            .map(([key, url]) => (
            <div
              key={key}
              className="rounded-lg border border-app-border bg-app-secondary/30 p-3"
            >
              <p className="font-medium capitalize">{key}</p>
              <p className="mt-1 break-all text-app-muted">{url}</p>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
