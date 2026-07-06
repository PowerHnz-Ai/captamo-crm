"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";

interface WhatsappStatus {
  configured: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  tokenMasked: string;
  configuredAt?: number;
}

interface ClientWhatsappConfigModalProps {
  companyId: string;
  companyName: string;
  onClose: () => void;
}

/** Configuração da API oficial de uma clínica — exclusivo do platform admin. */
export function ClientWhatsappConfigModal({
  companyId,
  companyName,
  onClose,
}: ClientWhatsappConfigModalProps) {
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch(`/api/platform/clients/${companyId}/whatsapp`)
      .then(async (res) => {
        const data = await parseApiJson<{ status?: WhatsappStatus; error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Erro ao carregar configuração.");
        if (active && data.status) {
          setStatus(data.status);
          setPhoneNumberId(data.status.phoneNumberId || "");
          setWabaId(data.status.wabaId || "");
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/api/platform/clients/${companyId}/whatsapp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          phoneNumberId: phoneNumberId.trim(),
          wabaId: wabaId.trim(),
        }),
      });
      const data = await parseApiJson<{ status?: WhatsappStatus; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao salvar configuração.");
      if (data.status) setStatus(data.status);
      setToken("");
      setSuccess("Credenciais salvas. O envio desta clínica já usa a API própria.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-app-border bg-app-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">API oficial do WhatsApp</h2>
            <p className="text-sm text-app-muted">
              {companyName} — código {companyId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-app-muted hover:bg-white/5 hover:text-app-text"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-app-subtle">Carregando...</p>
        ) : (
          <>
            {status?.configured ? (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>
                    Configurada
                    {status.configuredAt
                      ? ` em ${new Date(status.configuredAt).toLocaleDateString("pt-BR")}`
                      : ""}{" "}
                    — token {status.tokenMasked}
                  </p>
                  <p className="text-xs text-emerald-200/80">
                    Número: {status.phoneNumberId} · WABA: {status.wabaId}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Ainda não configurada — o envio de mensagens desta clínica está
                  bloqueado até salvar as credenciais.
                </p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <Input
                id="wa-token"
                label={status?.configured ? "Novo token permanente" : "Token permanente"}
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token do System User (Meta Business)"
                required
              />
              <Input
                id="wa-phone-number-id"
                label="ID do número (phoneNumberId)"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="Ex.: 114943367..."
                required
              />
              <Input
                id="wa-waba-id"
                label="ID da conta WhatsApp Business (WABA)"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="Ex.: 143463959..."
                required
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              {success && <p className="text-sm text-emerald-300">{success}</p>}
              <Button type="submit" className="w-full" loading={saving}>
                {status?.configured ? "Atualizar credenciais" : "Ativar API da clínica"}
              </Button>
              <p className="text-xs text-app-muted">
                As credenciais são validadas na Meta e guardadas criptografadas no
                servidor. O recebimento de mensagens passa a rotear pelo ID do
                número — cada clínica só vê as próprias conversas.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
