"use client";

import { useEffect, useRef } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

export type InboxPeriodFilter = "" | "today" | "yesterday" | "7d" | "30d";

export interface InboxFiltersState {
  statusFilter: string;
  windowFilter: string;
  periodFilter: InboxPeriodFilter;
  tagFilter: string;
  assigneeFilter: string;
  unreadOnly: boolean;
  mineOnly: boolean;
  noResponseOnly: boolean;
}

interface AssigneeOption {
  uid: string;
  name: string;
}

interface InboxFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: InboxFiltersState;
  onChange: (patch: Partial<InboxFiltersState>) => void;
  activeCount: number;
  tagOptions: string[];
  assigneeOptions: AssigneeOption[];
  showAssigneeFilter?: boolean;
  showMineFilter?: boolean;
  showNoResponseFilter?: boolean;
  showUnassignedOnly?: boolean;
}

export function countActiveInboxFilters(filters: InboxFiltersState): number {
  let count = 0;
  if (filters.statusFilter) count++;
  if (filters.windowFilter) count++;
  if (filters.periodFilter) count++;
  if (filters.tagFilter) count++;
  if (filters.assigneeFilter) count++;
  if (filters.unreadOnly) count++;
  if (filters.mineOnly) count++;
  if (filters.noResponseOnly) count++;
  return count;
}

export function InboxFilterPanel({
  open,
  onOpenChange,
  filters,
  onChange,
  activeCount,
  tagOptions,
  assigneeOptions,
  showAssigneeFilter,
  showMineFilter,
  showNoResponseFilter,
  showUnassignedOnly,
}: InboxFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onOpenChange]);

  function clearAll() {
    onChange({
      statusFilter: "",
      windowFilter: "",
      periodFilter: "",
      tagFilter: "",
      assigneeFilter: "",
      unreadOnly: false,
      mineOnly: false,
      noResponseOnly: false,
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-colors ${
          open || activeCount > 0
            ? "border-app-accent/50 bg-app-accent/10 text-app-text"
            : "border-app-border bg-app-secondary/50 text-app-subtle hover:text-app-text"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtros
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-app-accent px-1 text-[0.6875rem] font-bold text-black">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-30 mt-2 w-[min(100vw-1.5rem,22rem)] rounded-xl border border-app-border bg-app-card p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Filtros do inbox</h3>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1 text-app-muted hover:bg-white/5"
              aria-label="Fechar filtros"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block chat-text-meta text-app-subtle">Status</label>
              <Select
                value={filters.statusFilter}
                onChange={(e) => onChange({ statusFilter: e.target.value })}
              >
                <option value="">Todas</option>
                <option value="open">Abertas</option>
                <option value="closed">Fechadas</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block chat-text-meta text-app-subtle">
                Janela WhatsApp
              </label>
              <Select
                value={filters.windowFilter}
                onChange={(e) => onChange({ windowFilter: e.target.value })}
              >
                <option value="">Qualquer</option>
                <option value="open">Dentro de 24h</option>
                <option value="closed">Fora de 24h</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block chat-text-meta text-app-subtle">
                Período da conversa
              </label>
              <Select
                value={filters.periodFilter}
                onChange={(e) =>
                  onChange({ periodFilter: e.target.value as InboxPeriodFilter })
                }
              >
                <option value="">Qualquer</option>
                <option value="today">Hoje</option>
                <option value="yesterday">Ontem</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
              </Select>
            </div>

            {tagOptions.length > 0 && (
              <div>
                <label className="mb-1 block chat-text-meta text-app-subtle">Tag</label>
                <Select
                  value={filters.tagFilter}
                  onChange={(e) => onChange({ tagFilter: e.target.value })}
                >
                  <option value="">Qualquer</option>
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {showAssigneeFilter && (
              <div>
                <label className="mb-1 block chat-text-meta text-app-subtle">
                  Responsável
                </label>
                <Select
                  value={filters.assigneeFilter}
                  onChange={(e) => onChange({ assigneeFilter: e.target.value })}
                >
                  <option value="">Qualquer</option>
                  <option value="__unassigned__">Não atribuídas</option>
                  {!showUnassignedOnly &&
                    assigneeOptions.map((a) => (
                      <option key={a.uid} value={a.uid}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-app-border pt-3">
              <Checkbox
                label="Não lidas"
                checked={filters.unreadOnly}
                onChange={(checked) => onChange({ unreadOnly: checked })}
                labelClassName="chat-text-meta text-app-subtle"
              />
              {showMineFilter && (
                <Checkbox
                  label="Minhas"
                  checked={filters.mineOnly}
                  onChange={(checked) => onChange({ mineOnly: checked })}
                  labelClassName="chat-text-meta text-app-subtle"
                />
              )}
              {showNoResponseFilter && (
                <Checkbox
                  label="Sem resposta"
                  checked={filters.noResponseOnly}
                  onChange={(checked) => onChange({ noResponseOnly: checked })}
                  labelClassName="chat-text-meta text-app-subtle"
                />
              )}
            </div>
          </div>

          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full text-sm"
              onClick={clearAll}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
