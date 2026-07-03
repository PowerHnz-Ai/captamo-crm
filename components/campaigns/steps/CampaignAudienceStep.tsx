"use client";



import { useMemo } from "react";

import { Checkbox } from "@/components/ui/Checkbox";

import { Input } from "@/components/ui/Input";

import { Select } from "@/components/ui/Select";

import {

  CampaignSpreadsheetImport,

  type SpreadsheetImportState,

} from "@/components/campaigns/CampaignSpreadsheetImport";

import type { AudienceMode } from "@/components/campaigns/campaign-wizard-types";

import { LEAD_CLASSES } from "@/lib/lead-class";

import type { Campaign, Contact, ContactOrigin } from "@/lib/types";



interface AudienceModeOption {

  value: AudienceMode;

  label: string;

  group: "crm" | "import";

}



interface CampaignAudienceStepProps {

  isEdit: boolean;

  editing?: Campaign | null;

  audienceMode: AudienceMode;

  onAudienceModeChange: (mode: AudienceMode) => void;

  audienceModes: AudienceModeOption[];

  eligibleCount: number | null;

  originEligibleCount: number | null;

  selectedOrigin: ContactOrigin | null;

  originFieldFilters: Record<string, string>;

  onOriginFieldFilterChange: (key: string, value: string) => void;

  originContacts: Contact[];

  allTags: string[];

  selectedTags: string[];

  onToggleTag: (tag: string) => void;

  selectedLeadClasses: number[];

  onToggleLeadClass: (value: number) => void;

  excludeTags: string[];

  onToggleExcludeTag: (tag: string) => void;

  excludeLeadClasses: number[];

  onToggleExcludeLeadClass: (value: number) => void;

  spreadsheet: SpreadsheetImportState;

  onSpreadsheetChange: (state: SpreadsheetImportState) => void;

  templateVarCount: number;

  originSpreadsheetFields: Array<{ key: string; label: string; required?: boolean }>;

  duplicatePolicy: "tag_existing" | "skip" | "update";

  onDuplicatePolicyChange: (policy: "tag_existing" | "skip" | "update") => void;

  excludeRecentEnabled: boolean;

  onExcludeRecentEnabledChange: (enabled: boolean) => void;

  excludeRecentDays: string;

  onExcludeRecentDaysChange: (days: string) => void;

}



function AudiencePill({

  active,

  label,

  onClick,

}: {

  active: boolean;

  label: string;

  onClick: () => void;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${

        active

          ? "border-app-accent bg-app-accent/15 text-app-text"

          : "border-app-border text-app-subtle hover:border-app-accent/40"

      }`}

    >

      {label}

    </button>

  );

}



function TagPills({

  tags,

  selected,

  onToggle,

  emptyLabel,

}: {

  tags: string[];

  selected: string[];

  onToggle: (tag: string) => void;

  emptyLabel?: string;

}) {

  if (tags.length === 0) {

    return <p className="text-sm text-app-muted">{emptyLabel || "Nenhuma tag encontrada."}</p>;

  }



  return (

    <div className="flex flex-wrap gap-2">

      {tags.map((tag) => (

        <button

          key={tag}

          type="button"

          onClick={() => onToggle(tag)}

          className={`rounded-full border px-3 py-1 text-xs transition-colors ${

            selected.includes(tag)

              ? "border-app-accent bg-app-accent/15 text-app-text"

              : "border-app-border text-app-subtle hover:border-app-accent/40"

          }`}

        >

          {tag}

        </button>

      ))}

    </div>

  );

}



export function CampaignAudienceStep({

  isEdit,

  editing,

  audienceMode,

  onAudienceModeChange,

  audienceModes,

  eligibleCount,

  originEligibleCount,

  selectedOrigin,

  originFieldFilters,

  onOriginFieldFilterChange,

  originContacts,

  allTags,

  selectedTags,

  onToggleTag,

  selectedLeadClasses,

  onToggleLeadClass,

  excludeTags,

  onToggleExcludeTag,

  excludeLeadClasses,

  onToggleExcludeLeadClass,

  spreadsheet,

  onSpreadsheetChange,

  templateVarCount,

  originSpreadsheetFields,

  duplicatePolicy,

  onDuplicatePolicyChange,

  excludeRecentEnabled,

  onExcludeRecentEnabledChange,

  excludeRecentDays,

  onExcludeRecentDaysChange,

}: CampaignAudienceStepProps) {

  const crmModes = audienceModes.filter((m) => m.group === "crm");

  const importModes = audienceModes.filter((m) => m.group === "import");



  const originFieldOptions = useMemo(() => {

    const map: Record<string, Set<string>> = {};

    for (const contact of originContacts) {

      const fields = contact.originFields || {};

      for (const [key, value] of Object.entries(fields)) {

        if (!value) continue;

        if (!map[key]) map[key] = new Set();

        map[key].add(value);

      }

    }

    return map;

  }, [originContacts]);



  const activeOriginFilters = Object.entries(originFieldFilters).filter(([, v]) => v);



  return (

    <div className="space-y-4">

      <div>

        <h3 className="font-medium text-app-text">Quem vai receber esta campanha?</h3>

        <p className="mt-1 text-sm text-app-muted">

          Escolha como definir o público-alvo da campanha.

        </p>

      </div>



      <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">

        {crmModes.length > 0 && (

          <div className="mb-4">

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">

              Contatos no CRM

            </p>

            <div className="grid gap-2 sm:grid-cols-2">

              {crmModes.map((m) => (

                <AudiencePill

                  key={m.value}

                  active={audienceMode === m.value}

                  label={m.label}

                  onClick={() => onAudienceModeChange(m.value)}

                />

              ))}

            </div>

          </div>

        )}



        {importModes.length > 0 && (

          <div>

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">

              Importação

            </p>

            <div className="grid gap-2 sm:grid-cols-2">

              {importModes.map((m) => (

                <AudiencePill

                  key={m.value}

                  active={audienceMode === m.value}

                  label={m.label}

                  onClick={() => onAudienceModeChange(m.value)}

                />

              ))}

            </div>

          </div>

        )}



        <div className="mt-4 border-t border-app-border/60 pt-4">

          {audienceMode === "keep" && (

            <p className="text-sm text-app-muted">

              O público atual ({editing?.totalContacts || 0} contatos) será mantido.

            </p>

          )}



          {audienceMode === "all" && (

            <p className="text-sm text-app-muted">

              Contatos que autorizaram receber campanhas (não bloqueados).

              {eligibleCount !== null && (

                <span className="ml-1 text-app-subtle">· {eligibleCount} elegíveis</span>

              )}

            </p>

          )}



          {audienceMode === "origin" && (

            <div className="space-y-3">

              <p className="text-sm text-app-muted">

                Contatos da origem{" "}

                <span className="text-app-subtle">{selectedOrigin?.label || "—"}</span> que

                autorizaram campanhas.

                {originEligibleCount !== null && (

                  <span className="ml-1 text-app-subtle">

                    · {originEligibleCount} elegíveis

                  </span>

                )}

              </p>



              {selectedOrigin && selectedOrigin.fields.length > 0 && (

                <div className="space-y-2">

                  <p className="text-xs font-medium uppercase tracking-wide text-app-muted">

                    Filtrar por campo da origem

                  </p>

                  {selectedOrigin.fields.map((field) => {

                    const values = [...(originFieldOptions[field.key] || [])].sort();

                    if (field.type === "month") {

                      return (

                        <Input

                          key={field.key}

                          id={`origin-filter-${field.key}`}

                          label={field.label}

                          type="month"

                          value={originFieldFilters[field.key] || ""}

                          onChange={(e) =>

                            onOriginFieldFilterChange(field.key, e.target.value)

                          }

                        />

                      );

                    }



                    return (

                      <Select

                        key={field.key}

                        id={`origin-filter-${field.key}`}

                        label={field.label}

                        value={originFieldFilters[field.key] || ""}

                        onChange={(e) =>

                          onOriginFieldFilterChange(field.key, e.target.value)

                        }

                      >

                        <option value="">Todos</option>

                        {values.map((value) => (

                          <option key={value} value={value}>

                            {value}

                          </option>

                        ))}

                      </Select>

                    );

                  })}

                  {activeOriginFilters.length > 0 && (

                    <p className="text-xs text-app-muted">

                      Filtros ativos:{" "}

                      {activeOriginFilters

                        .map(([key, value]) => {

                          const label =

                            selectedOrigin.fields.find((f) => f.key === key)?.label || key;

                          return `${label} = ${value}`;

                        })

                        .join(" · ")}

                    </p>

                  )}

                </div>

              )}

            </div>

          )}



          {audienceMode === "tags" && (

            <TagPills

              tags={allTags}

              selected={selectedTags}

              onToggle={onToggleTag}

              emptyLabel="Nenhuma tag encontrada."

            />

          )}



          {audienceMode === "classes" && (

            <div className="flex flex-wrap gap-2">

              {LEAD_CLASSES.map((item) => (

                <button

                  key={item.value}

                  type="button"

                  onClick={() => onToggleLeadClass(item.value)}

                  title={item.description}

                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${

                    selectedLeadClasses.includes(item.value)

                      ? "border-app-accent bg-app-accent/15 text-app-text"

                      : "border-app-border text-app-subtle hover:border-app-accent/40"

                  }`}

                >

                  <span className="font-medium">{item.label}</span>

                  <span className="mt-0.5 block text-[11px] text-app-muted">

                    {item.description}

                  </span>

                </button>

              ))}

            </div>

          )}



          {audienceMode === "upload" && !isEdit && (

            <div className="space-y-3">

              <CampaignSpreadsheetImport

                variableCount={templateVarCount}

                originSpreadsheetFields={originSpreadsheetFields}

                onChange={onSpreadsheetChange}

              />

              <div>

                <label className="mb-1.5 block text-sm font-medium text-app-subtle">

                  Contatos já existentes no CRM

                </label>

                <Select

                  value={duplicatePolicy}

                  onChange={(e) =>

                    onDuplicatePolicyChange(

                      e.target.value as "tag_existing" | "skip" | "update"

                    )

                  }

                >

                  <option value="tag_existing">

                    Adicionar tag da campanha (recomendado)

                  </option>

                  <option value="update">Atualizar nome e dados</option>

                  <option value="skip">Ignorar duplicatas</option>

                </Select>

              </div>

            </div>

          )}

        </div>

      </div>



      <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4 space-y-4">

        <p className="text-sm font-medium text-app-text">Exclusões de público</p>



        <Checkbox

          checked={excludeRecentEnabled}

          onChange={onExcludeRecentEnabledChange}

          label="Excluir contatos recentes"

        />

        {excludeRecentEnabled && (

          <div>

            <Input

              id="exclude-recent-days"

              type="number"

              min={1}

              max={365}

              label="Últimos N dias"

              value={excludeRecentDays}

              onChange={(e) => onExcludeRecentDaysChange(e.target.value)}

            />

            <p className="mt-1.5 text-xs text-app-muted">

              Não enviar para quem já participou de outro disparo nos últimos N dias.

            </p>

          </div>

        )}



        <div>

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">

            Excluir por tags

          </p>

          <TagPills

            tags={allTags}

            selected={excludeTags}

            onToggle={onToggleExcludeTag}

            emptyLabel="Nenhuma tag disponível para exclusão."

          />

        </div>



        <div>

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">

            Excluir por classe

          </p>

          <div className="flex flex-wrap gap-2">

            {LEAD_CLASSES.map((item) => (

              <button

                key={item.value}

                type="button"

                onClick={() => onToggleExcludeLeadClass(item.value)}

                className={`rounded-full border px-3 py-1 text-xs transition-colors ${

                  excludeLeadClasses.includes(item.value)

                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"

                    : "border-app-border text-app-subtle hover:border-app-accent/40"

                }`}

              >

                {item.label}

              </button>

            ))}

          </div>

        </div>

      </div>

    </div>

  );

}

