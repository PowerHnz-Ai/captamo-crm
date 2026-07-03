"use client";

import {
  CheckCircle2,
  Eye,
  MessageCircle,
  Send,
  Wallet,
  XCircle,
} from "lucide-react";
import type { Campaign, CampaignJob } from "@/lib/types";
import { computeJobStats, pct } from "@/lib/campaign-stats";
import {
  estimateCampaignSpend,
  formatCategoryLabel,
  formatUSD,
  getCampaignUnitCost,
} from "@/lib/campaign-pricing";

interface CampaignKpiRowProps {
  campaign: Campaign;
  jobs: CampaignJob[];
  templateCategory?: string;
}

const kpis = [
  { key: "sent", label: "Enviadas", icon: Send, color: "text-blue-400", base: "total" as const },
  { key: "delivered", label: "Entregues", icon: CheckCircle2, color: "text-emerald-400", base: "sent" as const },
  { key: "read", label: "Lidas", icon: Eye, color: "text-violet-400", base: "sent" as const },
  { key: "failed", label: "Falhas", icon: XCircle, color: "text-red-400", base: "total" as const },
  { key: "skipped", label: "Ignorados", icon: MessageCircle, color: "text-amber-400", base: "total" as const },
] as const;

export function CampaignKpiRow({ campaign, jobs, templateCategory }: CampaignKpiRowProps) {
  const stats = computeJobStats(jobs);
  const sentCount = stats.sent || campaign.sentCount;
  const sentBase = Math.max(sentCount, 1);
  const total = campaign.totalContacts || stats.total;

  const values: Record<(typeof kpis)[number]["key"], { count: number; pct: string; denominator: number }> = {
    sent: { count: sentCount, pct: pct(sentCount, total), denominator: total },
    delivered: { count: stats.delivered, pct: pct(stats.delivered, sentBase), denominator: sentBase },
    read: { count: stats.read, pct: pct(stats.read, sentBase), denominator: sentBase },
    failed: {
      count: stats.failed || campaign.failedCount,
      pct: pct(stats.failed || campaign.failedCount, total),
      denominator: total,
    },
    skipped: {
      count: stats.skipped || campaign.skippedCount || 0,
      pct: pct(stats.skipped || campaign.skippedCount || 0, total),
      denominator: total,
    },
  };

  const unitCost = getCampaignUnitCost(templateCategory);
  const estimatedSpend = estimateCampaignSpend(sentCount, templateCategory);
  const categoryLabel = formatCategoryLabel(templateCategory);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const value = values[kpi.key];
          return (
            <div
              key={kpi.key}
              className="rounded-2xl border border-app-border bg-app-secondary/30 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs font-medium uppercase tracking-wide text-app-muted">
                  {kpi.label}
                </span>
              </div>
              <p className="text-2xl font-semibold text-app-text">
                {value.count}
                <span className="ml-1 text-sm font-normal text-app-muted">
                  / {value.denominator}
                </span>
              </p>
              <p className={`mt-1 text-sm font-medium ${kpi.color}`}>{value.pct}%</p>
            </div>
          );
        })}
      </div>

      {sentCount > 0 && (
        <div
          className="rounded-2xl border border-app-border bg-app-secondary/30 p-4"
          title="Estimativa com base na tabela configurada; não substitui fatura Meta."
        >
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium uppercase tracking-wide text-app-muted">
              Custo estimado
            </span>
          </div>
          <p className="text-2xl font-semibold text-app-text">{formatUSD(estimatedSpend)}</p>
          <p className="mt-1 text-sm text-app-muted">
            {sentCount} enviadas × {formatUSD(unitCost)} ({categoryLabel})
          </p>
        </div>
      )}
    </div>
  );
}
