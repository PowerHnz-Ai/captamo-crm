"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { usePermissions } from "@/hooks/usePermissions";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { getEffectiveRole } from "@/lib/roles";
import type { AssignmentSettings, TeamUser } from "@/lib/types";

export default function AssignmentSettingsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("team.manage_roles");

  const [settings, setSettings] = useState<AssignmentSettings | null>(null);
  const [members, setMembers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canManage) {
      router.replace("/");
    }
  }, [canManage, router]);

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    Promise.all([
      apiFetch("/api/settings/assignment").then((res) =>
        parseApiJson<{ settings?: AssignmentSettings; error?: string }>(res)
      ),
      apiFetch("/api/team").then((res) =>
        parseApiJson<{ users?: TeamUser[]; error?: string }>(res)
      ),
    ])
      .then(([assignmentData, teamData]) => {
        if (!assignmentData.settings) {
          throw new Error(assignmentData.error || "Erro ao carregar.");
        }
        setSettings(assignmentData.settings);
        setMembers(
          (teamData.users || []).filter((u) => getEffectiveRole(u) === "member")
        );
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => setLoading(false));
  }, [canManage]);

  function toggleEligible(uid: string) {
    if (!settings) return;
    const allMemberUids = members.map((m) => m.uid);
    let current =
      settings.eligibleMemberUids.length === 0
        ? allMemberUids
        : [...settings.eligibleMemberUids];
    const next = current.includes(uid)
      ? current.filter((id) => id !== uid)
      : [...current, uid];
    const allSelected = allMemberUids.every((id) => next.includes(id));
    setSettings({
      ...settings,
      eligibleMemberUids: allSelected ? [] : next,
    });
  }

  function toggleInboxAttendant(uid: string) {
    if (!settings) return;
    const allMemberUids = members.map((m) => m.uid);
    let current =
      (settings.inboxAttendantUids?.length ?? 0) === 0
        ? allMemberUids
        : [...(settings.inboxAttendantUids || [])];
    const next = current.includes(uid)
      ? current.filter((id) => id !== uid)
      : [...current, uid];
    const allSelected = allMemberUids.every((id) => next.includes(id));
    setSettings({
      ...settings,
      inboxAttendantUids: allSelected ? [] : next,
      inboxAttendantOrder: allSelected
        ? []
        : (settings.inboxAttendantOrder || []).filter((id) => next.includes(id)),
    });
  }

  function moveInboxAttendant(uid: string, direction: -1 | 1) {
    if (!settings) return;
    const allMemberUids = members.map((m) => m.uid);
    const visible =
      (settings.inboxAttendantUids?.length ?? 0) === 0
        ? allMemberUids
        : [...(settings.inboxAttendantUids || [])];
    const ordered = [
      ...(settings.inboxAttendantOrder || []).filter((id) => visible.includes(id)),
      ...visible.filter((id) => !(settings.inboxAttendantOrder || []).includes(id)),
    ];
    const index = ordered.indexOf(uid);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSettings({
      ...settings,
      inboxAttendantUids:
        (settings.inboxAttendantUids?.length ?? 0) === 0 ? visible : settings.inboxAttendantUids,
      inboxAttendantOrder: next,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/settings/assignment", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      const data = await parseApiJson<{ settings?: AssignmentSettings; error?: string }>(
        res
      );
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
      setSettings(data.settings || settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) return null;

  return (
    <AppShell
      title="Atribuição automática"
      subtitle="Configure como novas conversas são distribuídas entre os atendentes."
    >
      <div className="max-w-2xl">
        {loading ? (
          <p className="text-sm text-app-subtle">Carregando...</p>
        ) : !settings ? (
          <p className="text-sm text-red-400">{error || "Configuração indisponível."}</p>
        ) : (
          <form onSubmit={save} className="space-y-6">
            <Card className="space-y-4 p-6">
              <Checkbox
                checked={settings.enabled}
                onChange={(enabled) => setSettings({ ...settings, enabled })}
                label={
                  <>
                    <span className="font-medium">Atribuição automática</span>
                    <span className="block text-sm text-app-subtle">
                      Distribui conversas recebidas via webhook.
                    </span>
                  </>
                }
                labelClassName="flex w-full flex-row-reverse items-center justify-between gap-4"
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-app-subtle">
                  Modo
                </label>
                <Select
                  value={settings.mode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      mode: e.target.value as AssignmentSettings["mode"],
                    })
                  }
                >
                  <option value="auto">Automática (webhook atribui)</option>
                  <option value="manual">Somente manual (na interface)</option>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-app-subtle">
                  Estratégia
                </label>
                <Select
                  value={settings.strategy}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      strategy: e.target.value as AssignmentSettings["strategy"],
                    })
                  }
                >
                  <option value="least_load">Menor carga (últimos dias)</option>
                  <option value="round_robin">Rodízio simples</option>
                </Select>
              </div>

              <Input
                id="window-days"
                label="Janela de contagem de carga (dias)"
                type="number"
                min={1}
                max={90}
                value={String(settings.windowDays)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    windowDays: Number(e.target.value) || 7,
                  })
                }
              />

              <Input
                id="max-open"
                label="Limite máximo de conversas abertas por atendente (opcional)"
                type="number"
                min={1}
                value={settings.maxOpenPerMember ? String(settings.maxOpenPerMember) : ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxOpenPerMember: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="Sem limite"
              />

              <Checkbox
                checked={settings.reassignIfClosed}
                onChange={(reassignIfClosed) =>
                  setSettings({ ...settings, reassignIfClosed })
                }
                label="Reatribuir quando a conversa estava fechada ou sem responsável ao receber nova mensagem"
                labelClassName="items-start text-sm text-app-subtle"
                className="mt-0.5"
              />
            </Card>

            <Card className="p-6">
              <h3 className="font-medium">Atendentes elegíveis</h3>
              <p className="mt-1 text-sm text-app-subtle">
                Deixe vazio para incluir todos os colaboradores (membros).
              </p>
              <ul className="mt-4 space-y-2">
                {members.length === 0 ? (
                  <li className="text-sm text-app-muted">Nenhum atendente cadastrado.</li>
                ) : (
                  members.map((member) => {
                    const allMemberUids = members.map((m) => m.uid);
                    const eligible =
                      settings.eligibleMemberUids.length === 0
                        ? allMemberUids
                        : settings.eligibleMemberUids;
                    return (
                    <li key={member.uid}>
                      <Checkbox
                        label={member.name || member.email || member.uid}
                        checked={eligible.includes(member.uid)}
                        onChange={() => toggleEligible(member.uid)}
                        labelClassName="text-sm"
                      />
                    </li>
                    );
                  })
                )}
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-medium">Atendentes no inbox</h3>
              <p className="mt-1 text-sm text-app-subtle">
                Defina quem aparece na seção &quot;Usuários&quot; do rail do inbox e a ordem de exibição.
                Deixe vazio para incluir todos os colaboradores.
              </p>
              <ul className="mt-4 space-y-2">
                {members.length === 0 ? (
                  <li className="text-sm text-app-muted">Nenhum atendente cadastrado.</li>
                ) : (
                  (() => {
                    const allMemberUids = members.map((m) => m.uid);
                    const visible =
                      (settings.inboxAttendantUids?.length ?? 0) === 0
                        ? allMemberUids
                        : settings.inboxAttendantUids || [];
                    const ordered = [
                      ...(settings.inboxAttendantOrder || []).filter((id) =>
                        visible.includes(id)
                      ),
                      ...visible.filter(
                        (id) => !(settings.inboxAttendantOrder || []).includes(id)
                      ),
                    ];
                    return ordered.map((uid, index) => {
                      const member = members.find((m) => m.uid === uid);
                      if (!member) return null;
                      const checked = visible.includes(uid);
                      return (
                        <li
                          key={uid}
                          className="flex items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2"
                        >
                          <Checkbox
                            label={member.name || member.email || member.uid}
                            checked={checked}
                            onChange={() => toggleInboxAttendant(uid)}
                            labelClassName="text-sm"
                          />
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              disabled={index === 0}
                              onClick={() => moveInboxAttendant(uid, -1)}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              disabled={index === ordered.length - 1}
                              onClick={() => moveInboxAttendant(uid, 1)}
                            >
                              ↓
                            </Button>
                          </div>
                        </li>
                      );
                    });
                  })()
                )}
              </ul>
            </Card>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" loading={saving}>
              Salvar configurações
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
