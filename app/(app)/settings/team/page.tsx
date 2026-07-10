"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TeamOnlineTab } from "@/components/team/TeamOnlineTab";
import { UserAvatar } from "@/components/users/UserAvatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { roleLabel, getEffectiveRole } from "@/lib/roles";
import { sendResetEmail, sendResetEmailSmart } from "@/lib/password-actions";
import type { UserRole } from "@/lib/types";

// 3 papéis da clínica (admin é interno da Captamo, fora do seletor).
// gerente=Líder e leader=Supervisor têm o mesmo poder; muda só o rótulo.
const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "member", label: "Atendente" },
  { value: "leader", label: "Supervisor" },
  { value: "gerente", label: "Líder" },
];

type TeamMember = {
  uid: string;
  email?: string;
  name?: string;
  role?: UserRole | string;
  jobTitle?: string;
  photoUrl?: string;
};

export default function TeamSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "online" ? "online" : "team";
  const { loading: authLoading, profile, refreshProfile } = useAuth();
  const { can } = usePermissions();

  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");

  const canViewTeam = can("team.view");
  const canManageRoles = can("team.manage_roles");
  const canViewOnline = can("team.view_online");

  // Teto do ator: admin/platform admin podem tudo; gerente não toca em admin.
  const actorIsAdmin =
    profile?.effectiveRole === "admin" || profile?.platformAdmin === true;
  const roleOptions = actorIsAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((o) => o.value !== "admin");
  const canManageTarget = (targetRole: UserRole) =>
    actorIsAdmin || targetRole !== "admin";

  // Formulário de novo colaborador.
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<UserRole>("member");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true);
    setAddError("");
    try {
      const res = await apiFetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          email: addEmail.trim(),
          role: addRole,
        }),
      });
      const data = await parseApiJson<{
        email?: string;
        emailSent?: boolean;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao criar colaborador.");

      let note = "";
      try {
        // O servidor já envia o e-mail de boas-vindas da Captamo; o fallback
        // nativo do Firebase só roda se o SMTP estiver indisponível.
        if (data.email && !data.emailSent) await sendResetEmail(data.email);
        note = "\n\nUm e-mail para definir a senha foi enviado.";
      } catch {
        note =
          "\n\nConta criada, mas o envio do e-mail falhou — use 'Esqueci minha senha' na tela de login.";
      }
      await appAlert(`Colaborador cadastrado!${note}`, {
        title: "Colaborador criado",
        variant: "success",
      });
      setAddName("");
      setAddEmail("");
      setAddRole("member");
      setShowAdd(false);
      loadUsers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setAddSaving(false);
    }
  }

  async function resetMemberPassword(email: string) {
    const confirmed = await appConfirm(
      `Enviar um e-mail de redefinição de senha para "${email}"?`,
      { title: "Redefinir senha", confirmLabel: "Enviar" }
    );
    if (!confirmed) return;
    try {
      await sendResetEmailSmart(email);
      await appAlert("E-mail de redefinição enviado.", { variant: "success" });
    } catch {
      await appAlert("Não foi possível enviar o e-mail agora.", {
        title: "Erro",
        variant: "error",
      });
    }
  }

  useEffect(() => {
    if (!authLoading && !canViewTeam) {
      router.replace("/");
    }
  }, [authLoading, canViewTeam, router]);

  function loadUsers() {
    if (authLoading || !profile) return;
    setLoading(true);
    apiFetch("/api/team")
      .then(async (res) => {
        const data = await parseApiJson<{ users?: TeamMember[]; error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Erro ao carregar equipe.");
        if (!data.users) throw new Error("Erro ao carregar equipe.");
        setUsers(data.users);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!authLoading && canViewTeam && tab === "team") loadUsers();
  }, [authLoading, canViewTeam, tab, profile?.uid]);

  async function updateRole(uid: string, role: UserRole) {
    setSavingUid(uid);
    try {
      const res = await apiFetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, role }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
      loadUsers();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setSavingUid(null);
    }
  }

  function startEdit(user: TeamMember) {
    setEditingUid(user.uid);
    setEditName(user.name || "");
    setEditJobTitle(user.jobTitle || "");
  }

  async function saveEdit(uid: string) {
    setSavingUid(uid);
    try {
      const res = await apiFetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          name: editName.trim(),
          jobTitle: editJobTitle.trim() || null,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
      setEditingUid(null);
      loadUsers();
      if (uid === profile?.uid) await refreshProfile();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setSavingUid(null);
    }
  }

  async function removeUser(uid: string, name: string) {
    const confirmed = await appConfirm(
      `Remover o acesso de "${name}" a esta empresa? A conta Firebase será mantida.`,
      { title: "Remover usuário", confirmLabel: "Remover", destructive: true }
    );
    if (!confirmed) return;

    setSavingUid(uid);
    try {
      const res = await apiFetch(`/api/team?uid=${encodeURIComponent(uid)}`, {
        method: "DELETE",
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao remover.");
      loadUsers();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setSavingUid(null);
    }
  }

  async function uploadAvatar(uid: string, file: File) {
    setSavingUid(uid);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch(`/api/me/avatar?uid=${encodeURIComponent(uid)}`, {
        method: "POST",
        body: formData,
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao enviar foto.");
      loadUsers();
      if (uid === profile?.uid) await refreshProfile();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Erro", {
        title: "Erro",
        variant: "error",
      });
    } finally {
      setSavingUid(null);
    }
  }

  function setTab(next: "team" | "online") {
    const params = new URLSearchParams();
    if (next === "online") params.set("tab", "online");
    const qs = params.toString();
    router.push(qs ? `/settings/team?${qs}` : "/settings/team");
  }

  if (!canViewTeam) {
    return (
      <AppShell title="Equipe">
        <p className="text-app-subtle">Sem permissão para acessar esta página.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Equipe"
      subtitle="Gerencie perfis, cargos e permissões da equipe"
    >
      <div className="mb-4 flex gap-2 border-b border-app-border">
        <button
          type="button"
          onClick={() => setTab("team")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "team"
              ? "border-app-accent text-app-accent"
              : "border-transparent text-app-subtle hover:text-app-text"
          }`}
        >
          Equipe
        </button>
        {canViewOnline && (
          <button
            type="button"
            onClick={() => setTab("online")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "online"
                ? "border-app-accent text-app-accent"
                : "border-transparent text-app-subtle hover:text-app-text"
            }`}
          >
            Online agora
          </button>
        )}
      </div>

      {tab === "online" && canViewOnline ? (
        <Card hover={false}>
          <TeamOnlineTab />
        </Card>
      ) : (
        <Card hover={false}>
          {canManageRoles && (
            <div className="mb-4">
              {!showAdd ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAdd(true);
                    setAddError("");
                  }}
                >
                  + Adicionar colaborador
                </Button>
              ) : (
                <form
                  onSubmit={createMember}
                  className="rounded-lg border border-app-border bg-app-secondary/30 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      id="add-name"
                      label="Nome"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      required
                    />
                    <Input
                      id="add-email"
                      label="E-mail"
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      required
                    />
                    <div>
                      <label
                        htmlFor="add-role"
                        className="mb-1 block text-xs font-medium text-app-subtle"
                      >
                        Cargo
                      </label>
                      <Select
                        id="add-role"
                        compact
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value as UserRole)}
                      >
                        {roleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  {addError && (
                    <p className="mt-2 text-sm text-red-400">{addError}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button type="submit" loading={addSaving}>
                      Criar e enviar e-mail
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAdd(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-app-muted">
                    O colaborador receberá um e-mail para definir a própria senha.
                  </p>
                </form>
              )}
            </div>
          )}
          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
          {loading ? (
            <p className="text-app-subtle">Carregando equipe...</p>
          ) : users.length === 0 ? (
            <p className="text-app-subtle">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-app-border text-app-muted">
                    <th className="pb-3 pr-4 font-medium">Colaborador</th>
                    <th className="pb-3 pr-4 font-medium">Cargo</th>
                    <th className="pb-3 pr-4 font-medium">Permissão</th>
                    {canManageRoles && <th className="pb-3 font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const currentRole = (user.role || "member") as UserRole;
                    const displayName = user.name || user.email || user.uid;
                    const isEditing = editingUid === user.uid;

                    return (
                      <tr key={user.uid} className="border-b border-app-border/60">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <label className="relative cursor-pointer">
                              <UserAvatar
                                name={displayName}
                                seed={displayName}
                                photoUrl={user.photoUrl}
                                size="md"
                              />
                              {canManageRoles && (
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="absolute inset-0 cursor-pointer opacity-0"
                                  disabled={savingUid === user.uid}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void uploadAvatar(user.uid, file);
                                    e.target.value = "";
                                  }}
                                />
                              )}
                            </label>
                            <div className="min-w-0">
                              {isEditing ? (
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="mb-1"
                                />
                              ) : (
                                <p className="font-medium">{displayName}</p>
                              )}
                              <p className="truncate text-xs text-app-muted">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <Input
                              value={editJobTitle}
                              onChange={(e) => setEditJobTitle(e.target.value)}
                              placeholder="Cargo profissional"
                            />
                          ) : (
                            <span className="text-app-subtle">
                              {user.jobTitle || "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {canManageRoles && canManageTarget(currentRole) ? (
                            <Select
                              compact
                              defaultValue={currentRole}
                              onChange={(e) =>
                                updateRole(user.uid, e.target.value as UserRole)
                              }
                              disabled={savingUid === user.uid}
                            >
                              {roleOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Badge tone="neutral">{roleLabel(currentRole)}</Badge>
                          )}
                        </td>
                        {canManageRoles && (
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              {isEditing ? (
                                <>
                                  <Button
                                    type="button"
                                    className="px-2 py-1 text-xs"
                                    loading={savingUid === user.uid}
                                    onClick={() => saveEdit(user.uid)}
                                  >
                                    Salvar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="px-2 py-1 text-xs"
                                    onClick={() => setEditingUid(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : canManageTarget(currentRole) ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="px-2 py-1 text-xs"
                                    onClick={() => startEdit(user)}
                                  >
                                    Editar
                                  </Button>
                                  {user.email && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="px-2 py-1 text-xs"
                                      onClick={() => resetMemberPassword(user.email!)}
                                    >
                                      Redefinir senha
                                    </Button>
                                  )}
                                  {user.uid !== profile?.uid && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                                      disabled={savingUid === user.uid}
                                      onClick={() => removeUser(user.uid, displayName)}
                                    >
                                      Remover
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-app-muted">—</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={loadUsers}>
              Atualizar lista
            </Button>
            {error.includes("login") && (
              <Button
                variant="secondary"
                onClick={async () => {
                  await refreshProfile();
                  loadUsers();
                }}
              >
                Revalidar sessão
              </Button>
            )}
          </div>
        </Card>
      )}
    </AppShell>
  );
}
