"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Plus, Smartphone, Trash2, RefreshCw, CheckCircle2, LogOut, Webhook } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { usePermissions } from "@/hooks/usePermissions";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";

interface ConnectionRow {
  id: string;
  label: string;
  provider: "meta_cloud" | "wasender" | "evolution";
  status: "connected" | "connecting" | "disconnected";
  instanceId?: string;
  phoneNumber?: string;
  isDefault?: boolean;
}

const PROVIDER_LABEL: Record<ConnectionRow["provider"], string> = {
  meta_cloud: "Meta Cloud (oficial)",
  wasender: "Wasender",
  evolution: "Evolution API",
};

const STATUS_TONE: Record<ConnectionRow["status"], "success" | "warning" | "neutral"> = {
  connected: "success",
  connecting: "warning",
  disconnected: "neutral",
};

const STATUS_LABEL: Record<ConnectionRow["status"], string> = {
  connected: "Conectado",
  connecting: "Aguardando QR",
  disconnected: "Desconectado",
};

export default function ConnectionsPage() {
  const { can } = usePermissions();
  const canView = can("connections.view");
  const canManage = can("connections.manage");

  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    label: "",
    provider: "evolution" as ConnectionRow["provider"],
    baseUrl: "",
  });

  const [qrConnection, setQrConnection] = useState<ConnectionRow | null>(null);
  const [officialApi, setOfficialApi] = useState<{
    configured: boolean;
    phoneNumberId?: string;
    tokenMasked: string;
    configuredAt?: number;
  } | null>(null);

  useEffect(() => {
    if (!canView) return;
    apiFetch("/api/settings/whatsapp-status")
      .then((r) =>
        parseApiJson<{ status?: NonNullable<typeof officialApi> }>(r)
      )
      .then((data) => setOfficialApi(data.status ?? null))
      .catch(() => setOfficialApi(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const load = useCallback(() => {
    apiFetch("/api/connections")
      .then((r) => parseApiJson<{ connections?: ConnectionRow[] }>(r))
      .then((data) => setConnections(data.connections || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await parseApiJson<{ connection?: ConnectionRow; error?: string }>(res);
      if (!res.ok || !data.connection) {
        throw new Error(data.error || "Erro ao criar conexão.");
      }
      setShowForm(false);
      setForm({ label: "", provider: "evolution", baseUrl: "" });
      load();
      if (data.connection.provider !== "meta_cloud") {
        setQrConnection(data.connection);
      }
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao criar conexão.", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDisconnect(connection: ConnectionRow) {
    const ok = await appConfirm(
      "Desconectar o WhatsApp sem remover a conexão? Você poderá reconectar pelo QR depois.",
      { title: "Desconectar", confirmLabel: "Desconectar" }
    );
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/connections/${connection.id}/disconnect`, {
        method: "POST",
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao desconectar.");
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao desconectar.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  async function handleRepairWebhook(connection: ConnectionRow) {
    try {
      const res = await apiFetch(`/api/connections/${connection.id}/webhook`, {
        method: "POST",
      });
      const data = await parseApiJson<{
        webhookConfigured?: boolean;
        url?: string;
        error?: string;
      }>(res);
      if (!res.ok || !data.webhookConfigured) {
        throw new Error(data.error || "Falha ao configurar webhook.");
      }
      await appAlert(`Webhook configurado:\n${data.url}`, {
        title: "Webhook OK",
        variant: "success",
      });
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao configurar webhook.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  async function handleDelete(connection: ConnectionRow) {
    const ok = await appConfirm(
      `Remover permanentemente a conexão "${connection.label}"? Ela será excluída do CRM e o número será desconectado.`,
      { title: "Remover conexão", variant: "error", confirmLabel: "Remover" }
    );
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/connections/${connection.id}`, {
        method: "DELETE",
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao remover.");
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro ao remover.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  if (!canView) {
    return (
      <AppShell title="Conexões" subtitle="Números de WhatsApp">
        <p className="text-app-subtle">Apenas administradores podem acessar conexões.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Conexões" subtitle="Números de WhatsApp conectados">
      {officialApi && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            officialApi.configured
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {officialApi.configured ? (
            <p>
              API oficial configurada pela equipe Captamo
              {officialApi.configuredAt
                ? ` em ${new Date(officialApi.configuredAt).toLocaleDateString("pt-BR")}`
                : ""}{" "}
              — token {officialApi.tokenMasked}. Alterações são feitas pela equipe
              Captamo.
            </p>
          ) : (
            <p>
              WhatsApp ainda não configurado. O envio de mensagens está bloqueado
              até a equipe Captamo concluir a ativação da API desta conta.
            </p>
          )}
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-app-subtle">
          Adicione números via Evolution API lendo um QR code.
        </p>
        {canManage && (
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar número
          </Button>
        )}
      </div>

      {showForm && canManage && (
        <Card hover={false} className="mb-6">
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <Input
              id="label"
              label="Nome da conexão"
              placeholder="Ex.: API Mister Odonto"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
            <Select
              id="provider"
              label="Provedor"
              value={form.provider}
              onChange={(e) =>
                setForm({ ...form, provider: e.target.value as ConnectionRow["provider"] })
              }
            >
              <option value="evolution">Evolution API</option>
            </Select>
            <div className="md:col-span-2">
              <Input
                id="baseUrl"
                label="Base URL da API (opcional)"
                placeholder="Deixe em branco para usar o padrão"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" loading={creating}>
                Criar e gerar QR
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-app-subtle">Carregando...</p>
      ) : connections.length === 0 ? (
        <Card hover={false}>
          <p className="text-app-subtle">Nenhuma conexão cadastrada ainda.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {connections.map((c) => (
            <Card key={c.id} hover={false} className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-accent/15 text-app-accent">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{c.label}</p>
                  {c.isDefault && <Badge tone="neutral">Padrão</Badge>}
                </div>
                <p className="text-xs text-app-muted">
                  {PROVIDER_LABEL[c.provider]}
                  {c.phoneNumber ? ` · ${c.phoneNumber}` : ""}
                </p>
              </div>
              <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              {canManage && c.provider !== "meta_cloud" && (
                <>
                  {(c.status === "connected" || c.status === "connecting") && (
                    <Button
                      variant="ghost"
                      onClick={() => handleDisconnect(c)}
                      title="Desconectar WhatsApp"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => handleRepairWebhook(c)}
                    title="Configurar webhook"
                  >
                    <Webhook className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setQrConnection(c)}
                    title="Reconectar / ver QR"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(c)}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4 text-red-300" />
                  </Button>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      {qrConnection && (
        <QrModal
          connection={qrConnection}
          onClose={() => {
            setQrConnection(null);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function QrModal({
  connection,
  onClose,
}: {
  connection: ConnectionRow;
  onClose: () => void;
}) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [status, setStatus] = useState("Gerando QR code...");
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await apiFetch(`/api/connections/${connection.id}/qr`);
        const data = await parseApiJson<{
          connected?: boolean;
          base64?: string;
          code?: string;
          error?: string;
          webhookConfigured?: boolean;
          webhookWarning?: string;
        }>(res);

        if (!active) return;

        if (!res.ok) {
          setStatus(data.error || "Erro ao obter QR code.");
        } else if (data.connected) {
          setConnected(true);
          setStatus("Conectado com sucesso!");
          setQrImage(null);
          if (data.webhookConfigured === false) {
            await appAlert(
              data.webhookWarning ||
                "WhatsApp conectado, mas o webhook não foi configurado na Evolution. Mensagens podem não chegar.",
              { title: "Aviso", variant: "warning" }
            );
          }
          setTimeout(() => active && onClose(), 1500);
          return;
        } else if (data.base64) {
          setQrImage(
            data.base64.startsWith("data:")
              ? data.base64
              : `data:image/png;base64,${data.base64}`
          );
          setStatus("Escaneie o QR code com o WhatsApp do número.");
        } else if (data.code) {
          const img = await QRCode.toDataURL(data.code, { width: 280 });
          if (!active) return;
          setQrImage(img);
          setStatus("Escaneie o QR code com o WhatsApp do número.");
        }
      } catch {
        if (active) setStatus("Falha ao conectar. Tentando novamente...");
      }

      if (active && !connected) {
        timerRef.current = setTimeout(poll, 4000);
      }
    }

    poll();
    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.id]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-app-border bg-app-card p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-display text-lg font-semibold">{connection.label}</h3>
        <p className="mb-4 text-xs text-app-muted">
          WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho
        </p>

        <div className="mx-auto flex h-[280px] w-[280px] items-center justify-center rounded-xl border border-app-border bg-white">
          {connected ? (
            <CheckCircle2 className="h-20 w-20 text-emerald-500" />
          ) : qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImage} alt="QR code" className="h-[260px] w-[260px]" />
          ) : (
            <RefreshCw className="h-8 w-8 animate-spin text-app-muted" />
          )}
        </div>

        <p className="mt-4 text-sm text-app-subtle">{status}</p>

        <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
