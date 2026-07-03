import type {
  Campaign,
  CampaignCadenceConfig,
  CampaignQuietHours,
} from "./types";

export interface CadenceEstimate {
  totalContacts: number;
  estimatedDurationMs: number;
  estimatedEndMs: number;
  label: string;
}

function getLocalMinutes(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isInQuietPeriod(date: Date, quietHours?: CampaignQuietHours): boolean {
  if (!quietHours?.enabled) return false;
  const current = getLocalMinutes(date, quietHours.timezone || "America/Sao_Paulo");
  const start = parseTimeToMinutes(quietHours.start);
  const end = parseTimeToMinutes(quietHours.end);

  if (start > end) {
    return current >= start || current < end;
  }
  return current >= start && current < end;
}

function advanceOneMinute(ms: number): number {
  return ms + 60_000;
}

export function adjustToSendWindow(
  ms: number,
  quietHours?: CampaignQuietHours
): number {
  if (!quietHours?.enabled) return ms;

  let candidate = ms;
  for (let i = 0; i < 7 * 24 * 60; i++) {
    if (!isInQuietPeriod(new Date(candidate), quietHours)) return candidate;
    candidate = advanceOneMinute(candidate);
  }
  return ms;
}

export function computeJobScheduledAtMs(
  index: number,
  totalContacts: number,
  startMs: number,
  campaign: Pick<
    Campaign,
    "dispatchMode" | "cadenceConfig" | "maxSendsPerRun" | "scheduledEndAt"
  >
): number {
  const mode = campaign.dispatchMode || "immediate";
  if (mode === "immediate") return startMs;

  const config = campaign.cadenceConfig;
  if (!config) return startMs;

  const messagesPerTick =
    config.messagesPerTick || campaign.maxSendsPerRun || 20;

  let rawMs = startMs;

  if (config.strategy === "interval") {
    const intervalMs = (config.intervalMinutes || 5) * 60_000;
    const tick = Math.floor(index / messagesPerTick);
    rawMs = startMs + tick * intervalMs;
  } else if (config.strategy === "per_hour") {
    const perHour = Math.max(1, config.messagesPerHour || 60);
    const intervalMs = Math.floor(3_600_000 / perHour);
    rawMs = startMs + index * intervalMs;
  } else if (config.strategy === "spread_until_end") {
    const endMs = campaign.scheduledEndAt?.toMillis?.() ?? startMs + 86_400_000;
    const span = Math.max(endMs - startMs, 60_000);
    if (totalContacts <= 1) {
      rawMs = startMs;
    } else {
      rawMs = startMs + Math.floor((index / (totalContacts - 1)) * span);
    }
  }

  return rawMs;
}

export function buildJobScheduleTimestamps(
  totalContacts: number,
  campaign: Pick<
    Campaign,
    | "dispatchMode"
    | "cadenceConfig"
    | "maxSendsPerRun"
    | "scheduledAt"
    | "scheduledEndAt"
    | "quietHours"
  >,
  nowMs = Date.now()
): number[] {
  const startMs = campaign.scheduledAt?.toMillis?.() ?? nowMs;
  const timestamps: number[] = [];

  for (let i = 0; i < totalContacts; i++) {
    const raw = computeJobScheduledAtMs(i, totalContacts, startMs, campaign);
    timestamps.push(adjustToSendWindow(raw, campaign.quietHours));
  }

  return timestamps;
}

export function estimateCampaignDuration(
  totalContacts: number,
  campaign: Pick<
    Campaign,
    | "dispatchMode"
    | "cadenceConfig"
    | "maxSendsPerRun"
    | "scheduledEndAt"
    | "dailySendLimit"
  >
): CadenceEstimate {
  const mode = campaign.dispatchMode || "immediate";
  const batch = campaign.maxSendsPerRun || 20;
  const dailyLimit = campaign.dailySendLimit;

  if (totalContacts === 0) {
    return {
      totalContacts: 0,
      estimatedDurationMs: 0,
      estimatedEndMs: Date.now(),
      label: "Nenhum contato",
    };
  }

  if (mode === "cadence") {
    const config = campaign.cadenceConfig;
    let durationMs = 0;

    if (config?.strategy === "spread_until_end" && campaign.scheduledEndAt) {
      durationMs = Math.max(
        (campaign.scheduledEndAt.toMillis?.() ?? Date.now()) - Date.now(),
        0
      );
    } else if (config?.strategy === "per_hour") {
      const perHour = Math.max(1, config.messagesPerHour || 60);
      durationMs = Math.ceil(totalContacts / perHour) * 3_600_000;
    } else {
      const intervalMs = (config?.intervalMinutes || 5) * 60_000;
      const messagesPerTick = config?.messagesPerTick || batch;
      const ticks = Math.ceil(totalContacts / messagesPerTick);
      durationMs = ticks * intervalMs;
    }

    if (dailyLimit && dailyLimit > 0) {
      const days = Math.ceil(totalContacts / dailyLimit);
      const dailyDuration = Math.min(durationMs, days * 86_400_000);
      durationMs = Math.max(durationMs, dailyDuration);
    }

    const hours = Math.floor(durationMs / 3_600_000);
    const minutes = Math.floor((durationMs % 3_600_000) / 60_000);
    const label =
      hours > 0
        ? `~${hours}h${minutes > 0 ? ` ${minutes}min` : ""} para concluir`
        : `~${Math.max(minutes, 1)} min para concluir`;

    return {
      totalContacts,
      estimatedDurationMs: durationMs,
      estimatedEndMs: Date.now() + durationMs,
      label: `${totalContacts.toLocaleString("pt-BR")} contatos · cadência · ${label}`,
    };
  }

  const batches = Math.ceil(totalContacts / batch);
  let durationMs = batches * 60_000;

  if (dailyLimit && dailyLimit > 0) {
    const days = Math.ceil(totalContacts / dailyLimit);
    durationMs = Math.max(durationMs, days * 86_400_000);
    return {
      totalContacts,
      estimatedDurationMs: durationMs,
      estimatedEndMs: Date.now() + durationMs,
      label: `${totalContacts.toLocaleString("pt-BR")} contatos · imediato · lote ${batch} · limite ${dailyLimit}/dia → ~${days} dia(s)`,
    };
  }

  const minutes = Math.max(Math.ceil(durationMs / 60_000), 1);
  return {
    totalContacts,
    estimatedDurationMs: durationMs,
    estimatedEndMs: Date.now() + durationMs,
    label: `${totalContacts.toLocaleString("pt-BR")} contatos · imediato · lote ${batch} → ~${minutes} min`,
  };
}

export function formatDispatchModeLabel(
  mode?: Campaign["dispatchMode"],
  config?: CampaignCadenceConfig
): string {
  if (!mode || mode === "immediate") return "Disparo imediato";
  if (!config) return "Disparo por cadência";
  if (config.strategy === "interval") {
    return `Cadência: a cada ${config.intervalMinutes || 5} min`;
  }
  if (config.strategy === "per_hour") {
    return `Cadência: ${config.messagesPerHour || 60}/hora`;
  }
  return "Cadência: distribuir até data fim";
}

export function getTodayDateKey(timezone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
