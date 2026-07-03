"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  buildCampaignParameters,
  buildPreviewContact,
  countTemplateVariables,
  renderTemplateBody,
} from "@/lib/campaign-params";
import type { Template } from "@/lib/types";
import type { MappedSpreadsheetRow } from "@/lib/campaign-spreadsheet";

export type ParameterMappingValue =
  | { type: "first_name" }
  | { type: "phone" }
  | { type: "literal_today" }
  | { type: "literal"; value: string }
  | { type: "column"; key: string; label: string }
  | { type: "origin"; key: string; label: string };

interface CampaignParameterMapperProps {
  template: Template;
  values: ParameterMappingValue[];
  onChange: (values: ParameterMappingValue[]) => void;
  columnOptions: Array<{ key: string; label: string }>;
  originFieldOptions?: Array<{ key: string; label: string }>;
  sampleRow?: MappedSpreadsheetRow | null;
}

function toMappingString(value: ParameterMappingValue): string {
  switch (value.type) {
    case "first_name":
      return "first_name";
    case "phone":
      return "phone";
    case "literal_today":
      return "literal_today";
    case "literal":
      return `literal:${value.value}`;
    case "column":
      return `column:${value.key}`;
    case "origin":
      return `origin:${value.key}`;
  }
}

export function parameterValuesToMapping(values: ParameterMappingValue[]): string[] {
  return values.map(toMappingString);
}

export function mappingStringToParameterValue(
  mapping: string,
  originFieldOptions: Array<{ key: string; label: string }> = []
): ParameterMappingValue {
  if (mapping === "first_name" || mapping === "name") return { type: "first_name" };
  if (mapping === "phone") return { type: "phone" };
  if (mapping === "literal_today") return { type: "literal_today" };
  if (mapping.startsWith("column:")) {
    const key = mapping.slice("column:".length);
    return { type: "column", key, label: key };
  }
  if (mapping.startsWith("origin:")) {
    const key = mapping.slice("origin:".length);
    const label = originFieldOptions.find((o) => o.key === key)?.label || key;
    return { type: "origin", key, label };
  }
  if (mapping.startsWith("literal:")) {
    return { type: "literal", value: mapping.slice("literal:".length) };
  }
  return { type: "literal", value: mapping };
}

export function defaultParameterValues(count: number): ParameterMappingValue[] {
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? { type: "first_name" } : { type: "literal", value: "" }
  );
}

export function CampaignParameterMapper({
  template,
  values,
  onChange,
  columnOptions,
  originFieldOptions = [],
  sampleRow,
}: CampaignParameterMapperProps) {
  const varCount = countTemplateVariables(template.body);

  const previewText = useMemo(() => {
    if (!sampleRow || values.length === 0) return null;
    const contact = buildPreviewContact({
      name: sampleRow.name || sampleRow.phone,
      phone: sampleRow.phone,
      customFields: sampleRow.customFields,
      originFields: sampleRow.originFields,
    });
    const params = buildCampaignParameters(contact, parameterValuesToMapping(values));
    return renderTemplateBody(template.body, params);
  }, [sampleRow, values, template.body]);

  function updateIndex(index: number, patch: Partial<ParameterMappingValue>) {
    const next = [...values];
    next[index] = { ...next[index]!, ...patch } as ParameterMappingValue;
    onChange(next);
  }

  function handleTypeChange(index: number, type: string) {
    if (type === "first_name") updateIndex(index, { type: "first_name" });
    else if (type === "phone") updateIndex(index, { type: "phone" });
    else if (type === "literal_today") updateIndex(index, { type: "literal_today" });
    else if (type.startsWith("column:")) {
      const key = type.slice("column:".length);
      const label = columnOptions.find((c) => c.key === key)?.label || key;
      updateIndex(index, { type: "column", key, label });
    } else if (type.startsWith("origin:")) {
      const key = type.slice("origin:".length);
      const label = originFieldOptions.find((o) => o.key === key)?.label || key;
      updateIndex(index, { type: "origin", key, label });
    } else {
      const current = values[index];
      const existing =
        current?.type === "literal" ? current.value : "";
      updateIndex(index, { type: "literal", value: existing });
    }
  }

  function currentTypeValue(value: ParameterMappingValue): string {
    if (value.type === "column") return `column:${value.key}`;
    if (value.type === "origin") return `origin:${value.key}`;
    if (value.type === "literal") return "literal";
    return value.type;
  }

  if (varCount === 0) return null;

  return (
    <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">
      <p className="mb-3 text-sm text-app-subtle">
        Variáveis ({varCount}):{" "}
        <span className="text-app-muted">{template.body}</span>
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: varCount }, (_, i) => {
          const value = values[i] || { type: "literal" as const, value: "" };
          return (
            <div key={i} className="space-y-2">
              <label className="block text-sm font-medium text-app-subtle">
                {`{{${i + 1}}}`}
              </label>
              <Select
                value={currentTypeValue(value)}
                onChange={(e) => handleTypeChange(i, e.target.value)}
              >
                <option value="first_name">Primeiro nome</option>
                <option value="phone">Telefone</option>
                {originFieldOptions.length > 0 && (
                  <optgroup label="Campos de origem">
                    {originFieldOptions.map((field) => (
                      <option key={field.key} value={`origin:${field.key}`}>
                        {field.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {columnOptions.length > 0 && (
                  <optgroup label="Colunas da planilha">
                    {columnOptions.map((col) => (
                      <option key={col.key} value={`column:${col.key}`}>
                        {col.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="literal_today">Data de hoje</option>
                <option value="literal">Texto fixo</option>
              </Select>
              {value.type === "literal" && (
                <Input
                  id={`param-literal-${i}`}
                  value={value.value}
                  onChange={(e) =>
                    updateIndex(i, { type: "literal", value: e.target.value })
                  }
                  placeholder="Texto fixo"
                />
              )}
            </div>
          );
        })}
      </div>

      {previewText && (
        <div className="mt-4 rounded-lg border border-app-accent/20 bg-app-accent/5 p-3">
          <p className="mb-1 text-xs font-medium uppercase text-app-muted">
            Preview da mensagem (1ª linha)
          </p>
          <p className="text-sm text-app-subtle">{previewText}</p>
        </div>
      )}
    </div>
  );
}
