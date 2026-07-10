"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogIn, MessageCircle, Pencil, Trash2, Users } from "lucide-react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/components/auth/AuthProvider";
import { appAlert } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { sendResetEmail } from "@/lib/password-actions";
import { startImpersonation, stopImpersonation } from "@/lib/impersonation";
import { setUltraMode } from "@/lib/ultra-mode";
import { ClientWhatsappConfigModal } from "@/components/platform/ClientWhatsappConfigModal";

type Company = {
  id: string;
  name: string;
  createdAt: number | null;
  userCount: number;
  whatsappConfigured: boolean;
};

export default function PlatformPage() {
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
  const [renamingCompany, setRenamingCompany] = useState<Company | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Chegar ao painel da plataforma sempre encerra uma impersonação ativa.
  useEffect(() => {
    stopImpersonation();
  }, []);

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

  function enterCompany(company: Company) {
    startImpersonation({
      companyId: company.id,
      companyName: company.name,
      startedAt: Date.now(),
    });
    setUltraMode("api");
    router.push("/");
  }

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
        emailSent?: boolean;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar cliente.");

      // O servidor já envia as boas-vindas da Captamo; o e-mail nativo do
      // Firebase é só fallback quando o SMTP está indisponível.
      let emailNote = "";
      try {
        if (data.managerEmail && !data.emailSent) await sendResetEmail(data.managerEmail);
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

  async function handleRenameCompany() {
    if (!renamingCompany) return;
    const name = renameText.trim();
    if (!name) {
      setRenameError("Informe o novo nome.");
      return;
    }
    setRenaming(true);
    setRenameError("");
    try {
      const res = await apiFetch(`/api/platform/clients/${renamingCompany.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao renomear empresa.");
      setRenamingCompany(null);
      setRenameText("");
      loadCompanies();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Erro ao renomear.");
    } finally {
      setRenaming(false);
    }
  }

  if (!isPlatformAdmin) {
    return (
      <PlatformShell title="Painel da plataforma">
        <p className="text-app-subtle">
          {authLoading ? "Carregando..." : "Sem permissão para acessar esta página."}
        </p>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title="Painel da plataforma"
      subtitle="Todas as clínicas do Captamo: cadastro, credenciais e acesso aos painéis"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card hover={false} className="self-start">
          <h2 className="mb-4 text-sm font-semibold text-app-text">
            Cadastrar nova clínica
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
              Cadastrar clínica
            </Button>
            <p className="text-xs text-app-muted">
              O gerente receberá um e-mail para definir a própria senha e poderá
              cadastrar os colaboradores da empresa dele.
            </p>
          </form>
        </Card>

        <Card hover={false}>
          <h2 className="mb-4 text-sm font-semibold text-app-text">
            Clínicas cadastradas
          </h2>
          {loading ? (
            <p className="text-app-subtle">Carregando...</p>
          ) : companies.length === 0 ? (
            <p className="text-app-subtle">Nenhuma clínica cadastrada ainda.</p>
          ) : (
            <ul className="divide-y divide-app-border/60">
              {companies.map((c) => (
                <li key={c.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-app-muted" />
                        <p className="truncate font-medium text-app-text">{c.name}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-muted">
                        <span>
                          Código:{" "}
                          <code className="rounded bg-white/10 px-1 py-0.5 font-mono">
                            {c.id}
                          </code>
                        </span>
                        {c.createdAt && (
                          <span>
                            Desde {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {c.userCount} usuário{c.userCount === 1 ? "" : "s"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            c.whatsappConfigured
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {c.whatsappConfigured
                            ? "API WhatsApp configurada"
                            : "API WhatsApp pendente"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" onClick={() => enterCompany(c)}>
                        <LogIn className="mr-1.5 h-4 w-4" />
                        Entrar no painel
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setWhatsappCompany(c)}
                      >
                        <MessageCircle className="mr-1.5 h-4 w-4" />
                        WhatsApp
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        title="Renomear empresa"
                        onClick={() => {
                          setRenameText(c.name);
                          setRenameError("");
                          setRenamingCompany(c);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
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
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
          onClose={() => {
            setWhatsappCompany(null);
            loadCompanies();
          }}
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

      {renamingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !renaming && setRenamingCompany(null)}
            aria-label="Fechar"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-app-border bg-app-card p-6 shadow-2xl">
            <h2 className="mb-2 font-display text-xl font-semibold">
              Renomear empresa
            </h2>
            <p className="mb-3 text-sm text-app-subtle">
              Código <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono">{renamingCompany.id}</code>{" "}
              — o código não muda, só o nome de exibição.
            </p>
            <Input
              id="rename-company"
              label="Novo nome"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              placeholder="Nome da empresa"
              autoFocus
            />
            {renameError && (
              <p className="mt-2 text-sm text-red-400">{renameError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={renaming}
                onClick={() => setRenamingCompany(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                loading={renaming}
                disabled={!renameText.trim()}
                onClick={() => void handleRenameCompany()}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </PlatformShell>
  );
}
