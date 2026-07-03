"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api-fetch";
import type { Deal, PipelineStage } from "@/lib/types";

export default function FunnelPage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function load() {
    apiFetch("/api/funnel")
      .then((r) => r.json())
      .then((data) => {
        setStages(data.stages || []);
        setDeals(data.deals || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function moveDeal(dealId: string, stageId: string) {
    const res = await apiFetch(`/api/funnel/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    if (res.ok) load();
  }

  return (
    <AppShell title="Funil comercial" subtitle="Kanban de leads e oportunidades">
      {loading ? (
        <p className="text-app-subtle">Carregando funil...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stageId === stage.id);
            return (
              <div
                key={stage.id}
                className="min-w-[260px] flex-1"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggingId) {
                    void moveDeal(draggingId, stage.id);
                    setDraggingId(null);
                  }
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: stage.color || "#6366f1" }}
                  />
                  <h3 className="font-semibold">{stage.name}</h3>
                  <Badge tone="neutral">{stageDeals.length}</Badge>
                </div>
                <div className="space-y-2">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggingId(deal.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <Card hover={false}>
                        <p className="font-medium">{deal.title}</p>
                        {deal.value != null && (
                          <p className="mt-1 text-sm text-app-muted">
                            R$ {deal.value.toLocaleString("pt-BR")}
                          </p>
                        )}
                        {deal.source && (
                          <p className="mt-1 text-xs text-app-subtle">{deal.source}</p>
                        )}
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
