"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { estimateCampaignDuration } from "@/lib/campaign-cadence";
import type {
  CampaignCadenceConfig,
  CampaignDispatchMode,
  CampaignQuietHours,
} from "@/lib/types";

export interface DispatchFormState {
  dispatchMode: CampaignDispatchMode;
  cadenceConfig: CampaignCadenceConfig;
  scheduledAt: string;
  scheduledEndAt: string;
  maxSendsPerRun: number;
  dailySendLimit: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const defaultDispatchState: DispatchFormState = {
  dispatchMode: "immediate",
  cadenceConfig: {
    strategy: "interval",
    intervalMinutes: 5,
    messagesPerTick: 20,
  },
  scheduledAt: "",
  scheduledEndAt: "",
  maxSendsPerRun: 20,
  dailySendLimit: "",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

interface CampaignDispatchModeProps {
  state: DispatchFormState;
  onChange: (state: DispatchFormState) => void;
  totalContacts: number;
}

export function CampaignDispatchModeSection({
  state,
  onChange,
  totalContacts,
}: CampaignDispatchModeProps) {
  const estimate = useMemo(() => {
    return estimateCampaignDuration(totalContacts, {
      dispatchMode: state.dispatchMode,
      cadenceConfig: state.cadenceConfig,
      maxSendsPerRun: state.maxSendsPerRun,
      dailySendLimit: state.dailySendLimit
        ? Number(state.dailySendLimit)
        : undefined,
      scheduledEndAt: state.scheduledEndAt
        ? new Date(state.scheduledEndAt).getTime()
        : undefined,
    });
  }, [totalContacts, state]);

  function patch(partial: Partial<DispatchFormState>) {
    onChange({ ...state, ...partial });
  }

  function patchCadence(partial: Partial<CampaignCadenceConfig>) {
    onChange({
      ...state,
      cadenceConfig: { ...state.cadenceConfig, ...partial },
    });
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">
      <p className="mb-3 text-sm font-medium text-app-subtle">Como disparar</p>

      <div className="mb-4 flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="dispatchMode"
            checked={state.dispatchMode === "immediate"}
            onChange={() => patch({ dispatchMode: "immediate" })}
          />
          Disparo imediato
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="dispatchMode"
            checked={state.dispatchMode === "cadence"}
            onChange={() => patch({ dispatchMode: "cadence" })}
          />
          Disparo por cadência
        </label>
      </div>

      {state.dispatchMode === "cadence" && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-app-subtle">
              Estratégia
            </label>
            <Select
              value={state.cadenceConfig.strategy}
              onChange={(e) =>
                patchCadence({
                  strategy: e.target.value as CampaignCadenceConfig["strategy"],
                })
              }
            >
              <option value="interval">Intervalo fixo</option>
              <option value="per_hour">Mensagens por hora</option>
              <option value="spread_until_end">Distribuir até data fim</option>
            </Select>
          </div>

          {state.cadenceConfig.strategy === "interval" && (
            <>
              <Input
                id="cadence-interval"
                label="A cada (minutos)"
                type="number"
                value={String(state.cadenceConfig.intervalMinutes || 5)}
                onChange={(e) =>
                  patchCadence({ intervalMinutes: Number(e.target.value) })
                }
              />
              <Input
                id="cadence-per-tick"
                label="Mensagens por intervalo"
                type="number"
                value={String(
                  state.cadenceConfig.messagesPerTick || state.maxSendsPerRun
                )}
                onChange={(e) =>
                  patchCadence({ messagesPerTick: Number(e.target.value) })
                }
              />
            </>
          )}

          {state.cadenceConfig.strategy === "per_hour" && (
            <Input
              id="cadence-per-hour"
              label="Mensagens por hora"
              type="number"
              value={String(state.cadenceConfig.messagesPerHour || 60)}
              onChange={(e) =>
                patchCadence({ messagesPerHour: Number(e.target.value) })
              }
            />
          )}

          {state.cadenceConfig.strategy === "spread_until_end" && (
            <Input
              id="cadence-end"
              label="Distribuir até (data/hora)"
              type="datetime-local"
              value={state.scheduledEndAt}
              onChange={(e) => patch({ scheduledEndAt: e.target.value })}
            />
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          id="camp-scheduled"
          label="Agendar início (opcional)"
          type="datetime-local"
          value={state.scheduledAt}
          onChange={(e) => patch({ scheduledAt: e.target.value })}
        />
        {state.dispatchMode === "immediate" && (
          <Input
            id="camp-scheduled-end"
            label="Agendar término (opcional)"
            type="datetime-local"
            value={state.scheduledEndAt}
            onChange={(e) => patch({ scheduledEndAt: e.target.value })}
          />
        )}
        <Input
          id="camp-batch"
          label="Lote por execução"
          type="number"
          value={String(state.maxSendsPerRun)}
          onChange={(e) => patch({ maxSendsPerRun: Number(e.target.value) })}
        />
        <Input
          id="camp-daily-limit"
          label="Limite diário (opcional)"
          type="number"
          value={state.dailySendLimit}
          onChange={(e) => patch({ dailySendLimit: e.target.value })}
          placeholder="ex: 500"
        />
      </div>

      <div className="mt-4 rounded-lg border border-app-border p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.quietHoursEnabled}
            onChange={(e) => patch({ quietHoursEnabled: e.target.checked })}
          />
          Horário comercial (não enviar fora da janela)
        </label>
        {state.quietHoursEnabled && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input
              id="quiet-start"
              label="Início quiet hours"
              type="time"
              value={state.quietHoursStart}
              onChange={(e) => patch({ quietHoursStart: e.target.value })}
            />
            <Input
              id="quiet-end"
              label="Fim quiet hours"
              type="time"
              value={state.quietHoursEnd}
              onChange={(e) => patch({ quietHoursEnd: e.target.value })}
            />
          </div>
        )}
      </div>

      {totalContacts > 0 && (
        <p className="mt-3 text-xs text-app-muted">{estimate.label}</p>
      )}
    </div>
  );
}

export function dispatchStateToQuietHours(
  state: DispatchFormState
): CampaignQuietHours | undefined {
  if (!state.quietHoursEnabled) return undefined;
  return {
    enabled: true,
    start: state.quietHoursStart,
    end: state.quietHoursEnd,
    timezone: "America/Sao_Paulo",
  };
}
