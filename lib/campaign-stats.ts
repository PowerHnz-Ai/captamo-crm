import type { Campaign, CampaignJob } from "./types";

export interface CampaignJobStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  pending: number;
  accepted: number;
}

export function computeJobStats(jobs: CampaignJob[]): CampaignJobStats {
  const stats: CampaignJobStats = {
    total: jobs.length,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    accepted: 0,
  };

  for (const job of jobs) {
    // "processing" conta como pendente: reservado por um runner, ainda sem desfecho.
    if (job.status === "pending" || job.status === "processing") stats.pending++;
    if (job.status === "skipped") stats.skipped++;
    if (job.status === "failed") stats.failed++;
    if (job.status === "sent") stats.sent++;

    const ms = job.messageStatus?.toLowerCase();
    if (ms === "read") {
      stats.read++;
      stats.delivered++;
    } else if (ms === "delivered") {
      stats.delivered++;
    } else if (ms === "accepted" || ms === "sent") {
      stats.accepted++;
    }
  }

  return stats;
}

export function pct(part: number, total: number): string {
  if (total <= 0) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

export function campaignStatusLabel(status: Campaign["status"]): string {
  const map: Record<Campaign["status"], string> = {
    draft: "Rascunho",
    running: "Em execução",
    paused: "Pausada",
    finished: "Concluída",
  };
  return map[status];
}

export type JobDisplayStatus =
  | "pending"
  | "processing"
  | "skipped"
  | "failed"
  | "accepted"
  | "delivered"
  | "read";

export function getJobDisplayStatus(job: CampaignJob): JobDisplayStatus {
  if (job.status === "pending") return "pending";
  if (job.status === "processing") return "processing";
  if (job.status === "skipped") return "skipped";
  if (job.status === "failed") return "failed";

  const ms = job.messageStatus?.toLowerCase();
  if (ms === "read") return "read";
  if (ms === "delivered") return "delivered";
  return "accepted";
}

export function jobStatusLabel(status: JobDisplayStatus): string {
  const map: Record<JobDisplayStatus, string> = {
    pending: "Pendente",
    processing: "Enviando…",
    skipped: "Ignorado",
    failed: "Falha",
    accepted: "Enviado",
    delivered: "Entregue",
    read: "Lida",
  };
  return map[status];
}

export function jobLastEventLabel(job: CampaignJob): string {
  const display = getJobDisplayStatus(job);
  const label = jobStatusLabel(display);
  const ts = job.updatedAt;
  const date = tsToDate(ts);
  if (!date) return label;
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${label} ${time}`;
}

export function tsToDate(
  value: Campaign["createdAt"] | CampaignJob["updatedAt"] | undefined
): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  }
  return phone.startsWith("+") ? phone : `+${digits}`;
}
