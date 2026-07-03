"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import {
  presenceRoleLabel,
  SURFACE_LABELS,
  type PresenceRecord,
  type PresenceStatus,
} from "@/lib/presence-shared";

type Filter = "all" | "online" | "away";

const STATUS_DOT: Record<PresenceStatus, string> = {
  online: "bg-emerald-400",
  away: "bg-amber-400",
  offline: "bg-app-muted",
};

const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Ausente",
  offline: "Offline",
};

export function TeamOnlineTab() {
  const [users, setUsers] = useState<PresenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  function load() {
    setLoading(true);
    apiFetch("/api/presence")
      .then(async (res) => {
        const data = await parseApiJson<{ users?: PresenceRecord[]; error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Erro ao carregar presença.");
        if (!data.users) throw new Error("Erro ao carregar presença.");
        return data;
      })
      .then((data) => {
        setUsers(data.users!);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  const filtered = users.filter((u) => {
    if (filter === "online") return u.status === "online";
    if (filter === "away") return u.status === "away";
    return true;
  });

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: "all", label: "Todos" },
            { id: "online", label: "Online" },
            { id: "away", label: "Ausente" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === opt.id
                ? "bg-app-accent/20 text-app-accent"
                : "bg-app-secondary/50 text-app-subtle hover:text-app-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          className="ml-auto rounded-lg border border-app-border px-3 py-1.5 text-xs text-app-subtle hover:text-app-text"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <p className="text-app-subtle">Carregando colaboradores online...</p>
      ) : filtered.length === 0 ? (
        <p className="text-app-subtle">Nenhum colaborador ativo no momento.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-app-border text-app-muted">
                <th className="pb-3 pr-4 font-medium">Colaborador</th>
                <th className="pb-3 pr-4 font-medium">Cargo</th>
                <th className="pb-3 pr-4 font-medium">Onde está</th>
                <th className="pb-3 pr-4 font-medium">Atividade</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.uid} className="border-b border-app-border/60">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{user.name || user.email || user.uid}</p>
                    {user.email && user.name && (
                      <p className="text-xs text-app-muted">{user.email}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone="neutral">{presenceRoleLabel(user.role)}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-app-subtle">
                    {SURFACE_LABELS[user.currentSurface]}
                  </td>
                  <td className="py-3 pr-4 text-xs text-app-muted">
                    {user.currentPath || "—"}
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2 text-xs">
                      <span
                        className={`h-2 w-2 rounded-full ${STATUS_DOT[user.status]}`}
                      />
                      {STATUS_LABEL[user.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
