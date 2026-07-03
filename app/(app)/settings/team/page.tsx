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
import { roleLabel } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "leader", label: "Líder" },
  { value: "member", label: "Colaborador" },
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
                          {canManageRoles ? (
                            <Select
                              compact
                              defaultValue={currentRole}
                              onChange={(e) =>
                                updateRole(user.uid, e.target.value as UserRole)
                              }
                              disabled={savingUid === user.uid}
                            >
                              {ROLE_OPTIONS.map((opt) => (
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
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="px-2 py-1 text-xs"
                                    onClick={() => startEdit(user)}
                                  >
                                    Editar
                                  </Button>
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
