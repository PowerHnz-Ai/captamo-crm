"use client";

import { useEffect, useState } from "react";
import {
  Send,
  Inbox,
  CheckCircle,
  Eye,
  AlertTriangle,
  UserMinus,
  FileText,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/dashboard/StatCard";
import { apiFetch } from "@/lib/api-fetch";

interface ReportStats {
  templatesSent: number;
  messagesSent: number;
  messagesReceived: number;
  messagesDelivered: number;
  messagesRead: number;
  messagesFailed: number;
  optOuts: number;
}

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [limits, setLimits] = useState<{
    sentToday: number;
    dailyCap: number;
    remaining: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/reports/overview?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setStats(data.stats);
        setLimits(data.limits);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [days]);

  return (
    <AppShell title="Relatórios" subtitle="Métricas de envio, entrega e opt-out">
      <div className="mb-6 flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              days === d
                ? "bg-app-accent/15 text-app-accent"
                : "text-app-subtle hover:bg-white/5"
            }`}
          >
            {d} dias
          </button>
        ))}
      </div>

      {limits && (
        <Card hover={false} className="mb-6">
          <p className="text-sm text-app-subtle">
            Limite hoje: {limits.sentToday}/{limits.dailyCap} · Restante:{" "}
            {limits.remaining}
          </p>
        </Card>
      )}

      {loading ? (
        <p className="text-app-subtle">Carregando relatórios...</p>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Templates enviados"
            value={stats.templatesSent}
            icon={FileText}
            gradient="from-emerald-400 to-teal-600"
          />
          <StatCard
            title="Mensagens enviadas"
            value={stats.messagesSent}
            icon={Send}
            gradient="from-blue-400 to-indigo-600"
          />
          <StatCard
            title="Mensagens recebidas"
            value={stats.messagesReceived}
            icon={Inbox}
            gradient="from-violet-400 to-purple-600"
          />
          <StatCard
            title="Entregues"
            value={stats.messagesDelivered}
            icon={CheckCircle}
            gradient="from-green-400 to-emerald-600"
          />
          <StatCard
            title="Lidas"
            value={stats.messagesRead}
            icon={Eye}
            gradient="from-cyan-400 to-blue-600"
          />
          <StatCard
            title="Falhas"
            value={stats.messagesFailed}
            icon={AlertTriangle}
            gradient="from-red-400 to-rose-600"
          />
          <StatCard
            title="Opt-outs"
            value={stats.optOuts}
            icon={UserMinus}
            gradient="from-amber-400 to-orange-600"
          />
        </div>
      ) : (
        <Card>
          <p className="text-app-subtle">Sem dados no período.</p>
        </Card>
      )}
    </AppShell>
  );
}
