"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  autoMapSpreadsheetColumns,
  buildCampaignTargetFields,
  downloadCampaignSpreadsheetTemplate,
  mapSpreadsheetRows,
  parseSpreadsheetFile,
  validateSpreadsheetRows,
  type MappedSpreadsheetRow,
  type SpreadsheetRow,
  type SpreadsheetTargetField,
  type SpreadsheetValidation,
} from "@/lib/campaign-spreadsheet";

export interface SpreadsheetImportState {
  fileName: string;
  rows: SpreadsheetRow[];
  mappedRows: MappedSpreadsheetRow[];
  columns: string[];
  mapping: Record<string, string>;
  validation: SpreadsheetValidation | null;
  ready: boolean;
}

interface CampaignSpreadsheetImportProps {
  variableCount: number;
  originSpreadsheetFields?: SpreadsheetTargetField[];
  onChange: (state: SpreadsheetImportState) => void;
}

const EMPTY_STATE: SpreadsheetImportState = {
  fileName: "",
  rows: [],
  mappedRows: [],
  columns: [],
  mapping: {},
  validation: null,
  ready: false,
};

export function CampaignSpreadsheetImport({
  variableCount,
  originSpreadsheetFields = [],
  onChange,
}: CampaignSpreadsheetImportProps) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<SpreadsheetRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const targetFields = useMemo(
    () => buildCampaignTargetFields(variableCount, originSpreadsheetFields),
    [variableCount, originSpreadsheetFields]
  );

  const mappedRows = useMemo(() => {
    if (!mapping.name || !mapping.phone || rows.length === 0) return [];
    return mapSpreadsheetRows(rows, mapping);
  }, [rows, mapping]);

  const validation = useMemo(() => {
    if (mappedRows.length === 0) return null;
    return validateSpreadsheetRows(mappedRows);
  }, [mappedRows]);

  const ready = Boolean(
    mapping.name && mapping.phone && mappedRows.length > 0 && (validation?.valid || 0) > 0
  );

  useEffect(() => {
    onChange({
      fileName,
      rows,
      mappedRows,
      columns,
      mapping,
      validation,
      ready,
    });
  }, [fileName, rows, mappedRows, columns, mapping, validation, ready, onChange]);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const parsed = parseSpreadsheetFile(buffer);
      if (parsed.rows.length === 0) {
        setRows([]);
        setColumns([]);
        setMapping({});
        return;
      }
      setRows(parsed.rows);
      setColumns(parsed.columns);
      setMapping(autoMapSpreadsheetColumns(parsed.columns, targetFields));
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            downloadCampaignSpreadsheetTemplate(
              variableCount,
              undefined,
              originSpreadsheetFields
            )
          }
        >
          Baixar modelo
        </Button>
        <label className="cursor-pointer">
          <span className="inline-flex h-10 items-center rounded-xl border border-app-border px-4 text-sm hover:bg-white/5">
            {fileName || "Escolher planilha (.xlsx)"}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>

      {columns.length > 0 && (
        <div className="space-y-2 rounded-xl border border-app-border p-3">
          <p className="text-sm font-medium">Mapeamento de colunas</p>
          {targetFields.map((field) => (
            <div key={field.key} className="grid gap-2 md:grid-cols-2">
              <span className="text-sm text-app-subtle">
                {field.label}
                {field.required && <span className="text-red-400"> *</span>}
              </span>
              <Select
                compact
                value={mapping[field.key] || ""}
                onChange={(e) =>
                  setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              >
                <option value="">— ignorar —</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      )}

      {validation && (
        <div className="rounded-xl border border-app-border bg-app-secondary/20 p-3 text-sm text-app-subtle">
          <p>
            <strong>{validation.valid}</strong> válidas de {validation.total} linhas
            {validation.invalid > 0 && (
              <span className="text-amber-400"> · {validation.invalid} inválidas</span>
            )}
            {validation.duplicatePhones > 0 && (
              <span className="text-amber-400">
                {" "}
                · {validation.duplicatePhones} telefones duplicados
              </span>
            )}
          </p>
        </div>
      )}

      {mappedRows.length > 0 && (
        <div className="overflow-x-auto">
          <p className="mb-2 text-xs text-app-muted">Prévia (até 5 linhas)</p>
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-app-border text-app-muted">
                <th className="px-2 py-1">Nome</th>
                <th className="px-2 py-1">Telefone</th>
                {variableCount > 0 && (
                  <th className="px-2 py-1">Variáveis</th>
                )}
              </tr>
            </thead>
            <tbody>
              {mappedRows.slice(0, 5).map((row) => (
                <tr key={row.rowIndex} className="border-b border-app-border/50">
                  <td className="px-2 py-1 text-app-subtle">{row.name || "—"}</td>
                  <td className="px-2 py-1 text-app-subtle">{row.phone}</td>
                  {variableCount > 0 && (
                    <td className="px-2 py-1 text-app-muted">
                      {Object.entries(row.customFields)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ") || "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { EMPTY_STATE as emptySpreadsheetState };
