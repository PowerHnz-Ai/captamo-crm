"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { ContactOrigin } from "@/lib/types";
import * as XLSX from "xlsx";

interface ExcelImportProps {
  onImported: () => void;
}

type RowRecord = Record<string, string>;

export function ExcelImport({ onImported }: ExcelImportProps) {
  const [origins, setOrigins] = useState<ContactOrigin[]>([]);
  const [originId, setOriginId] = useState("");
  const [rows, setRows] = useState<RowRecord[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [progress, setProgress] = useState("");
  const [invalidRows, setInvalidRows] = useState<
    Array<{ row: number; name: string; phone: string; reason: string }>
  >([]);

  const CHUNK_SIZE = 500;

  const selectedOrigin = origins.find((o) => o.id === originId);

  useEffect(() => {
    apiFetch("/api/contact-origins")
      .then((res) => res.json())
      .then((data) => {
        const items = (data.origins || []) as ContactOrigin[];
        setOrigins(items);
        if (items[0]) setOriginId(items[0].id);
      })
      .catch(() => setOrigins([]));
  }, []);

  const targetFields = useMemo(() => {
    const base = [
      { key: "name", label: "Nome" },
      { key: "phone", label: "Número" },
      { key: "tags", label: "Tags (separadas por |)" },
      { key: "date", label: "Data" },
    ];
    const originFields =
      selectedOrigin?.fields.map((f) => ({
        key: `origin_${f.key}`,
        label: f.label,
      })) || [];
    return [...base, ...originFields];
  }, [selectedOrigin]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!];
      const json = XLSX.utils.sheet_to_json<RowRecord>(sheet, { defval: "" });
      if (json.length === 0) return;
      const cols = Object.keys(json[0]!);
      setColumns(cols);
      setRows(json);
      const autoMap: Record<string, string> = {};
      for (const field of targetFields) {
        const match = cols.find((c) =>
          c.toLowerCase().includes(field.label.toLowerCase().slice(0, 4))
        );
        if (match) autoMap[field.key] = match;
      }
      setMapping(autoMap);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!mapping.name || !mapping.phone) {
      setResult("Mapeie pelo menos Nome e Número.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const contacts = rows.map((row) => {
        const originFields: Record<string, string> = {};
        for (const field of selectedOrigin?.fields || []) {
          const col = mapping[`origin_${field.key}`];
          if (col) originFields[field.key] = String(row[col] || "");
        }

        const tagsRaw = mapping.tags ? String(row[mapping.tags] || "") : "";
        return {
          name: String(row[mapping.name] || "").trim(),
          phone: String(row[mapping.phone] || "").trim(),
          tags: tagsRaw
            ? tagsRaw.split("|").map((t) => t.trim()).filter(Boolean)
            : ["importado"],
          source: selectedOrigin?.key || "excel",
          optIn: true,
          originId: originId || undefined,
          originFields: Object.keys(originFields).length ? originFields : undefined,
        };
      }).filter((c) => c.name && c.phone);

      if (contacts.length === 0) throw new Error("Nenhum contato válido na planilha.");

      // Envia em lotes para não estourar o limite do request com planilhas grandes.
      const totals = { created: 0, updated: 0, skipped: 0 };
      const invalid: Array<{ row: number; name: string; phone: string; reason: string }> = [];

      for (let offset = 0; offset < contacts.length; offset += CHUNK_SIZE) {
        const chunk = contacts.slice(offset, offset + CHUNK_SIZE);
        setProgress(
          `Importando ${Math.min(offset + chunk.length, contacts.length)} de ${contacts.length}...`
        );

        const res = await apiFetch("/api/contacts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: chunk }),
        });
        const data = await parseApiJson<{
          created?: number;
          updated?: number;
          skipped?: number;
          invalid?: Array<{ row: number; name: string; phone: string; reason: string }>;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error || "Erro na importação");

        totals.created += data.created ?? 0;
        totals.updated += data.updated ?? 0;
        totals.skipped += data.skipped ?? 0;
        for (const item of data.invalid ?? []) {
          // Reindexa a linha para a posição na planilha original.
          invalid.push({ ...item, row: item.row + offset });
        }
      }

      const parts = [`${totals.created} criados`];
      if (totals.updated) parts.push(`${totals.updated} atualizados`);
      if (totals.skipped) parts.push(`${totals.skipped} ignorados (já existiam)`);
      if (invalid.length) parts.push(`${invalid.length} inválidos`);
      setResult(parts.join(", ") + ".");
      setInvalidRows(invalid);
      setRows([]);
      setColumns([]);
      onImported();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setProgress("");
      setLoading(false);
    }
  }

  function downloadTemplate() {
    const headers = [
      "Nome",
      "Número",
      "Tags",
      "Data",
      ...(selectedOrigin?.fields.map((f) => f.label) || []),
    ];
    const example = [
      "João Silva",
      "5522999999999",
      "lead|vip",
      "2026-01",
      ...(selectedOrigin?.fields.map(() => "") || []),
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contatos");
    XLSX.writeFile(wb, "importacao-contatos-ultra.xlsx");
  }

  return (
    <Card>
      <h3 className="mb-2 font-display text-lg font-semibold">Importar Excel</h3>
      <p className="mb-3 text-xs text-app-muted">
        Faça upload de um arquivo .xlsx e mapeie as colunas.
      </p>

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <Select
          id="import-origin"
          label="Origem"
          value={originId}
          onChange={(e) => setOriginId(e.target.value)}
        >
          {origins.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <div className="flex items-end gap-2">
          <Button type="button" variant="secondary" onClick={downloadTemplate}>
            Baixar modelo
          </Button>
          <label className="cursor-pointer">
            <span className="inline-flex h-10 items-center rounded-xl border border-app-border px-4 text-sm hover:bg-white/5">
              Escolher arquivo
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
      </div>

      {columns.length > 0 && (
        <div className="mb-4 space-y-2 rounded-xl border border-app-border p-3">
          <p className="text-sm font-medium">Mapeamento de colunas</p>
          {targetFields.map((field) => (
            <div key={field.key} className="grid gap-2 md:grid-cols-2">
              <span className="text-sm text-app-subtle">{field.label}</span>
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

      {rows.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <p className="mb-2 text-xs text-app-muted">
            Prévia ({rows.length} linha{rows.length > 1 ? "s" : ""})
          </p>
          <table className="w-full min-w-[500px] text-left text-xs">
            <thead>
              <tr className="border-b border-app-border text-app-muted">
                {columns.map((col) => (
                  <th key={col} className="px-2 py-1">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-b border-app-border/50">
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-1 text-app-subtle">
                      {String(row[col] || "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {progress && <p className="mb-2 text-sm text-app-accent">{progress}</p>}
      {result && <p className="mb-2 text-sm text-app-subtle">{result}</p>}
      {invalidRows.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
          <p className="mb-1 text-xs font-medium text-amber-300">
            Linhas não importadas (telefone inválido):
          </p>
          <ul className="space-y-0.5 text-xs text-app-subtle">
            {invalidRows.map((item) => (
              <li key={`${item.row}-${item.phone}`}>
                Linha {item.row}: {item.name || "(sem nome)"} — {item.phone} ({item.reason})
              </li>
            ))}
          </ul>
        </div>
      )}
      {rows.length > 0 && (
        <Button onClick={handleImport} loading={loading}>
          Importar {rows.length} contato(s)
        </Button>
      )}
    </Card>
  );
}
