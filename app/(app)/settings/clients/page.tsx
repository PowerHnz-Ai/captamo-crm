"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/components/auth/AuthProvider";
import { appAlert } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { sendResetEmail } from "@/lib/password-actions";
import { ClientWhatsappConfigModal } from "@/components/platform/ClientWhatsappConfigModal";

type Company = { id: string; name: string; createdAt: number | null };

export default function ClientsPage() {
  const router = useRouter();
  const { loading: authLoading, profile } = useAuth();
  const isPlatformAdmin = profile?.platformAdmin === true;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [whatsappCompany, setWhatsappCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isPlatformAdmin) {
      router.replace("/");
    }
  }, [authLoading, isPlatformAdmin, router]);

  function loadCompanies() {
    setLoading(true);
    apiFetch("/api/platform/clients")
      .then(async (res) => {
        const data = await parseApiJson<{ companies?: Company[]; error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Erro ao listar empresas.");
        setCompanies(data.companies || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao listar."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!authLoading && isPlatformAdmin) loadCompanies();
  }, [authLoading, isPlatformAdmin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/platform/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          managerName: managerName.trim(),
          managerEmail: managerEmail.trim(),
        }),
      });
      const data = await parseApiJson<{
        companyId?: string;
        managerEmail?: string;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar cliente.");

      // Dispara o e-mail de definição de senha do gerente (Firebase).
      let emailNote = "";
      try {
        if (data.managerEmail) await sendResetEmail(data.managerEmail);
        emailNote = "\n\nUm e-mail para definir a senha foi enviado ao gerente.";
      } catch {
        emailNote =
          "\n\nA conta foi criada, mas o envio do e-mail de senha falhou — use 'Esqueci minha senha' na tela de login.";
      }

      await appAlert(
        `Cliente cadastrado!\n\nCódigo da empresa: ${data.companyId}${emailNote}`,
        { title: "Cliente criado", variant: "success" }
      );
      setCompanyName("");
      setManagerName("");
      setManagerEmail("");
      loadCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCompany() {
    if (!deletingCompany || deleteConfirmText.trim() !== deletingCompany.id) {
      setDeleteError("Digite o código da empresa exatamente como mostrado.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(
        `/api/platform/clients/${deletingCompany.id}?confirm=${encodeURIComponent(
          deleteConfirmText.trim()
        )}`,
        { method: "DELETE" }
      );
      const data = await parseApiJson<{ usersDeleted?: number; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao excluir empresa.");
      await appAlert(
        `Empresa ${deletingCompany.name} excluída.\n\n${data.usersDeleted ?? 0} conta(s) de usuário removida(s), junto com todos os dados (conversas, contatos, campanhas e checklist).`,
        { title: "Empresa excluída", variant: "success" }
      );
      setDeletingCompany(null);
      setDeleteConfirmText("");
      loadCompanies();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  }

  if (!isPlatformAdmin) {
    return (
      <AppShell title="Clientes">
        <p className="text-app-subtle">Sem permissão para acessar esta página.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Clientes"
      subtitle="Cadastre empresas-clientes e o gerente responsável"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card hover={false}>
          <h2 className="mb-4 text-sm font-semibold text-app-text">
            Cadastrar novo cliente
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="company-name"
              label="Nome da empresa"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Clínica Exemplo"
              required
            />
            <Input
              id="manager-name"
              label="Nome do gerente"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Nome completo"
              required
            />
            <Input
              id="manager-email"
              label="E-mail do gerente"
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              placeholder="gerente@empresa.com"
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" loading={saving}>
              Cadastrar cliente
            </Button>
            <p className="text-xs text-app-muted">
              O gerente receberá um e-mail para definir a própria senha e poderá
              cadastrar os colaboradores da empresa dele.
            </p>
          </form>
        </Card>

        <Card hover={false}>
          <h2 className="mb-4 text-sm font-semibold text-app-text">
            Empresas cadastradas
          </h2>
          {loading ? (
            <p className="text-app-subtle">Carregando...</p>
          ) : companies.length === 0 ? (
            <p className="text-app-subtle">Nenhuma empresa cadastrada ainda.</p>
          ) : (
            <ul className="divide-y divide-app-border/60">
              {companies.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-app-text">{c.name}</p>
                    <p className="text-xs text-app-muted">Código: {c.id}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {c.createdAt && (
                      <span className="text-xs text-app-muted">
                        {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setWhatsappCompany(c)}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        setDeleteConfirmText("");
                        setDeleteError("");
                        setDeletingCompany(c);
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {whatsappCompany && (
        <ClientWhatsappConfigModal
          companyId={whatsappCompany.id}
          companyName={whatsappCompany.name}
          onClose={() => setWhatsappCompany(null)}
        />
      )}

      {deletingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeletingCompany(null)}
            aria-label="Fechar"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-red-500/30 bg-app-card p-6 shadow-2xl">
            <h2 className="mb-2 font-display text-xl font-semibold text-red-300">
              Excluir empresa
            </h2>
            <p className="mb-3 text-sm text-app-subtle">
              Isto apaga <strong>{deletingCompany.name}</strong> por completo e
              não pode ser desfeito: todos os logins da equipe dela, conversas,
              contatos, campanhas, relatórios e os dados do checklist.
            </p>
            <p className="mb-2 text-sm text-app-subtle">
              Para confirmar, digite o código da empresa:{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-app-text">
                {deletingCompany.id}
              </code>
            </p>
            <Input
              id="delete-confirm"
              label=""
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deletingCompany.id}
              autoFocus
            />
            {deleteError && (
              <p className="mt-2 text-sm text-red-400">{deleteError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={deleting}
                onClick={() => setDeletingCompany(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleting}
                disabled={deleteConfirmText.trim() !== deletingCompany.id}
                onClick={() => void handleDeleteCompany()}
              >
                Excluir definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
