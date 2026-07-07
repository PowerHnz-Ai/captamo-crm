"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  MessageSquare,
  Send,
  Inbox,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-fetch";
import type { DashboardStats } from "@/lib/types";

const emptyStats: DashboardStats = {
  totalContacts: 0,
  totalConversations: 0,
  messagesSent: 0,
  messagesReceived: 0,
  messagesFailed: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => setStats(data.stats || emptyStats))
      .catch(() => setStats(emptyStats))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      title="Dashboard"
      subtitle="Visão geral da operação WhatsApp — Captamo"
    >
      {loading ? (
        <p className="text-app-subtle">Carregando métricas...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Total de contatos"
            value={stats.totalContacts}
            icon={Users}
            gradient="from-emerald-400 to-teal-600"
          />
          <StatCard
            title="Total de conversas"
            value={stats.totalConversations}
            icon={MessageSquare}
            gradient="from-blue-400 to-indigo-600"
          />
          <StatCard
            title="Mensagens enviadas"
            value={stats.messagesSent}
            icon={Send}
            gradient="from-green-400 to-emerald-600"
          />
          <StatCard
            title="Mensagens recebidas"
            value={stats.messagesReceived}
            icon={Inbox}
            gradient="from-violet-400 to-purple-600"
          />
          <StatCard
            title="Mensagens com falha"
            value={stats.messagesFailed}
            icon={AlertTriangle}
            gradient="from-red-400 to-rose-600"
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/contacts">
          <Button variant="secondary">
            Novo contato <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link href="/conversations">
          <Button>
            Ver conversas <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
