"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, MessageSquare, Search } from "lucide-react";
import type { CampaignJob } from "@/lib/types";
import {
  formatPhoneDisplay,
  getJobDisplayStatus,
  jobLastEventLabel,
  jobStatusLabel,
} from "@/lib/campaign-stats";
import { Button } from "@/components/ui/Button";

type Tab = "all" | "failures";

const PAGE_SIZE = 20;

const statusTone: Record<ReturnType<typeof getJobDisplayStatus>, string> = {
  pending: "border-app-border text-app-muted bg-white/5",
  skipped: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  failed: "border-red-500/40 text-red-300 bg-red-500/10",
  accepted: "border-blue-500/40 text-blue-300 bg-blue-500/10",
  delivered: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  read: "border-violet-500/40 text-violet-300 bg-violet-500/10",
};

interface CampaignRecipientsTableProps {
  jobs: CampaignJob[];
}

export function CampaignRecipientsTable({ jobs }: CampaignRecipientsTableProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const failures = useMemo(
    () => jobs.filter((j) => j.status === "failed" || j.status === "skipped"),
    [jobs]
  );

  const filtered = useMemo(() => {
    const base = tab === "failures" ? failures : jobs;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (j) =>
        (j.contactName || "").toLowerCase().includes(q) ||
        j.phone.includes(q) ||
        (j.deliveryPhone || "").includes(q)
    );
  }, [jobs, failures, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageJobs = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="rounded-2xl border border-app-border bg-app-secondary/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border p-4">
        <div className="flex gap-1 rounded-xl bg-app-secondary/60 p-1">
          <button
            type="button"
            onClick={() => {
              setTab("all");
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === "all"
                ? "bg-app-card text-app-text shadow-sm"
                : "text-app-muted hover:text-app-text"
            }`}
          >
            Destinatários ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("failures");
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === "failures"
                ? "bg-app-card text-app-text shadow-sm"
                : "text-app-muted hover:text-app-text"
            }`}
          >
            Falhas ({failures.length})
          </button>
        </div>

        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome ou telefone"
            className="w-full rounded-xl border border-app-border bg-app-secondary/50 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-app-border text-xs uppercase tracking-wide text-app-muted">
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Último evento</th>
              <th className="px-4 py-3 font-medium">Chat</th>
            </tr>
          </thead>
          <tbody>
            {pageJobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-app-muted">
                  Nenhum destinatário encontrado.
                </td>
              </tr>
            ) : (
              pageJobs.map((job) => {
                const display = getJobDisplayStatus(job);
                const phone = job.deliveryPhone || job.phone;
                return (
                  <tr
                    key={job.id}
                    className="border-b border-app-border/50 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 font-medium text-app-text">
                      {job.contactName || "—"}
                    </td>
                    <td className="px-4 py-3 text-app-subtle">
                      {formatPhoneDisplay(phone)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone[display]}`}
                      >
                        {jobStatusLabel(display)}
                      </span>
                      {job.lastError && display === "failed" && (
                        <p className="mt-1 max-w-[200px] truncate text-xs text-red-300/80">
                          {job.lastError}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-app-muted">
                      {jobLastEventLabel(job)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/conversations?phone=${encodeURIComponent(phone)}`}>
                        <Button type="button" variant="secondary" className="h-8 gap-1.5 px-2.5 text-xs">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Ver no chat
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border px-4 py-3 text-sm text-app-muted">
          <span>
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}{" "}
            destinatários
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(1)}
              className="rounded-lg border border-app-border px-2 py-1 disabled:opacity-40"
            >
              «
            </button>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-app-border px-2 py-1 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
              const n = i + 1;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`min-w-8 rounded-lg border px-2 py-1 ${
                    currentPage === n
                      ? "border-app-accent bg-app-accent/20 text-app-accent"
                      : "border-app-border"
                  }`}
                >
                  {n}
                </button>
              );
            })}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-app-border px-2 py-1 disabled:opacity-40"
            >
              ›
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="rounded-lg border border-app-border px-2 py-1 disabled:opacity-40"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
