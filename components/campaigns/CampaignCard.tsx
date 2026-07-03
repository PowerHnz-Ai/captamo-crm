"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreHorizontal, Send, Users } from "lucide-react";
import type { Campaign, CampaignJob } from "@/lib/types";
import {
  campaignStatusLabel,
  computeJobStats,
  pct,
  tsToDate,
} from "@/lib/campaign-stats";

interface CampaignCardProps {
  campaign: Campaign;
  jobs?: CampaignJob[];
  onAction?: (action: "start" | "pause" | "run") => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function CampaignCard({
  campaign,
  jobs = [],
  onAction,
  onEdit,
  onDuplicate,
  onDelete,
}: CampaignCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function handleMenuAction(action: () => void) {
    action();
    closeMenu();
  }

  const stats = computeJobStats(jobs);
  const sentBase = stats.sent || campaign.sentCount;
  const hasStats = campaign.status !== "draft" && (sentBase > 0 || stats.pending > 0);
  const createdAt = tsToDate(campaign.createdAt);
  const updatedAt = tsToDate(campaign.updatedAt);

  const statusClass =
    campaign.status === "finished"
      ? "text-emerald-400"
      : campaign.status === "running"
        ? "text-blue-400"
        : campaign.status === "paused"
          ? "text-amber-400"
          : "text-app-muted";

  return (
    <article className="glass-card flex h-full flex-col p-5 transition hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <Link href={`/campaigns/${campaign.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold text-app-text hover:text-app-accent">
            {campaign.name}
          </h3>
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="rounded-lg p-1.5 text-app-muted hover:bg-white/5 hover:text-app-text"
            aria-label="Ações"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 min-w-[150px] rounded-xl border border-app-border bg-app-card py-1 shadow-xl"
            >
              {onAction && campaign.status === "draft" && (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => handleMenuAction(() => onAction("start"))}
                >
                  Iniciar
                </button>
              )}
              {onAction && campaign.status === "running" && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                    onClick={() => handleMenuAction(() => onAction("run"))}
                  >
                    Processar lote
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-white/5"
                    onClick={() => handleMenuAction(() => onAction("pause"))}
                  >
                    Pausar
                  </button>
                </>
              )}
              {onAction && campaign.status === "paused" && (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => handleMenuAction(() => onAction("start"))}
                >
                  Retomar
                </button>
              )}
              {onEdit && campaign.status === "draft" && (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => handleMenuAction(onEdit)}
                >
                  Editar
                </button>
              )}
              {onDuplicate && (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => handleMenuAction(onDuplicate)}
                >
                  Duplicar
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-white/5"
                  onClick={() => handleMenuAction(onDelete)}
                >
                  Excluir
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-app-muted">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {campaign.totalContacts} destinatários
        </span>
        {updatedAt && campaign.status !== "draft" && (
          <span className="inline-flex items-center gap-1">
            <Send className="h-3.5 w-3.5" />
            {formatDistanceToNow(updatedAt, { addSuffix: true, locale: ptBR })}
          </span>
        )}
      </div>

      {hasStats ? (
        <div className="mb-4 grid grid-cols-4 gap-2 rounded-xl border border-app-border/80 bg-app-secondary/40 p-3">
          <div className="text-center">
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-app-muted">
              Enviados
            </p>
            <p className="mt-1 text-lg font-semibold text-app-text">{sentBase}</p>
          </div>
          <div className="text-center">
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-app-muted">
              Entregues
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">
              {pct(stats.delivered, sentBase)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-app-muted">
              Lidos
            </p>
            <p className="mt-1 text-lg font-semibold text-violet-400">
              {pct(stats.read, sentBase)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-app-muted">
              Falhas
            </p>
            <p className="mt-1 text-lg font-semibold text-orange-400">
              {campaign.failedCount || stats.failed}
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-1 items-center rounded-xl border border-dashed border-app-border/60 bg-app-secondary/20 px-4 py-6 text-sm text-app-muted">
          {campaign.status === "draft"
            ? "Campanha ainda não iniciada"
            : "Aguardando primeiros envios"}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-app-border/60 pt-3 text-xs">
        <span className="text-app-muted">
          {createdAt
            ? `Criado ${formatDistanceToNow(createdAt, { addSuffix: true, locale: ptBR })}`
            : "—"}
        </span>
        <span className={`font-medium ${statusClass}`}>
          {campaignStatusLabel(campaign.status)}
        </span>
      </div>
    </article>
  );
}
