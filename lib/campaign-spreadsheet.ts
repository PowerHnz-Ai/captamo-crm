import * as XLSX from "xlsx";
import { normalizePhone } from "./whatsapp/phone";

export type SpreadsheetRow = Record<string, string>;

export interface MappedSpreadsheetRow {
  name: string;
  phone: string;
  tags: string[];
  customFields: Record<string, string>;
  originFields?: Record<string, string>;
  raw: SpreadsheetRow;
  rowIndex: number;
}

export interface SpreadsheetValidation {
  total: number;
  valid: number;
  invalid: number;
  duplicatePhones: number;
  emptyName: number;
  invalidPhones: string[];
  duplicatePhoneList: string[];
}

export interface SpreadsheetTargetField {
  key: string;
  label: string;
  required?: boolean;
}

const FIELD_SYNONYMS: Record<string, string[]> = {
  name: ["nome", "name", "cliente", "paciente"],
  phone: ["telefone", "tel", "phone", "numero", "número", "whats", "celular", "cel"],
  tags: ["tags", "tag", "etiqueta", "etiquetas"],
  var_1: ["nome", "name"],
  var_2: ["data", "date", "dia"],
  var_3: ["hora", "time", "horario", "horário"],
  "origin:paciente_indicador": ["indicador", "paciente indicador", "quem indicou"],
  "origin:nome_evento": ["evento", "nome do evento", "nome evento"],
  "origin:mes_indicacao": ["mês indicação", "mes indicacao", "mês da indicação"],
  "origin:mes_evento": ["mês evento", "mes evento", "mês do evento"],
  "origin:mes_entrada": ["mês entrada", "mes entrada", "mês de entrada"],
};

export function buildCampaignTargetFields(
  variableCount: number,
  originFields: SpreadsheetTargetField[] = []
): SpreadsheetTargetField[] {
  const base: SpreadsheetTargetField[] = [
    { key: "name", label: "Nome", required: true },
    { key: "phone", label: "Telefone", required: true },
    { key: "tags", label: "Tags (opcional)" },
    ...originFields,
  ];
  for (let i = 1; i <= variableCount; i++) {
    base.push({
      key: `var_${i}`,
      label: `Variável {{${i}}}`,
    });
  }
  return base;
}

export function buildCampaignTemplateColumns(
  variableCount: number,
  originFields: SpreadsheetTargetField[] = []
): string[] {
  const cols = ["Nome", "Telefone", "Tags", ...originFields.map((f) => f.label)];
  for (let i = 1; i <= variableCount; i++) {
    if (i === 2) cols.push("Data");
    else if (i === 3) cols.push("Hora");
    else cols.push(`Variável ${i}`);
  }
  return cols;
}

export function downloadCampaignSpreadsheetTemplate(
  variableCount: number,
  filename?: string,
  originFields: SpreadsheetTargetField[] = []
) {
  const headers = buildCampaignTemplateColumns(variableCount, originFields);
  const originExamples = originFields.map((f) => {
    if (f.key === "origin:paciente_indicador") return "Maria Silva";
    if (f.key === "origin:nome_evento") return "Feira de Saúde";
    if (f.key.includes("mes")) return "2026-06";
    return "";
  });
  const exampleRow = [
    "João Silva",
    "5522999999999",
    "lead|vip",
    ...originExamples,
    ...Array.from({ length: Math.max(0, variableCount) }, (_, i) => {
      if (i === 1) return "25/06/2026";
      if (i === 2) return "14:30";
      return "";
    }),
  ];

  const instructions = [
    ["Instruções"],
    ["1. Preencha Nome e Telefone (obrigatórios)."],
    ["2. Telefone no formato internacional sem símbolos, ex: 5522999999999."],
    ["3. Tags opcionais, separadas por |."],
    ...(originFields.length
      ? [["4. Preencha os campos de origem conforme a campanha selecionada."]]
      : []),
    ["5. Colunas extras podem ser mapeadas às variáveis do template no modal."],
    [],
    ["Exemplo", ...headers],
    exampleRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow.slice(0, headers.length)]);
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contatos");
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instruções");
  XLSX.writeFile(wb, filename || "modelo-campanha-ultra.xlsx");
}

export function parseSpreadsheetFile(buffer: ArrayBuffer): {
  rows: SpreadsheetRow[];
  columns: string[];
} {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const json = XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, { defval: "" });
  if (json.length === 0) return { rows: [], columns: [] };
  const columns = Object.keys(json[0]!);
  return { rows: json, columns };
}

export function autoMapSpreadsheetColumns(
  columns: string[],
  targetFields: SpreadsheetTargetField[]
): Record<string, string> {
  const autoMap: Record<string, string> = {};
  const used = new Set<string>();

  for (const field of targetFields) {
    const synonyms = FIELD_SYNONYMS[field.key] || [
      field.label.toLowerCase().slice(0, 4),
    ];
    const match = columns.find((col) => {
      if (used.has(col)) return false;
      const lower = col.toLowerCase();
      return (
        synonyms.some((s) => lower.includes(s)) ||
        lower.includes(field.label.toLowerCase().slice(0, 4))
      );
    });
    if (match) {
      autoMap[field.key] = match;
      used.add(match);
    }
  }

  return autoMap;
}

function parseTags(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[|,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function mapSpreadsheetRows(
  rows: SpreadsheetRow[],
  mapping: Record<string, string>
): MappedSpreadsheetRow[] {
  return rows.map((row, rowIndex) => {
    const customFields: Record<string, string> = {};
    const originFields: Record<string, string> = {};

    for (const [key, col] of Object.entries(mapping)) {
      if (!col || key === "name" || key === "phone" || key === "tags") continue;
      const value = String(row[col] || "").trim();
      if (!value) continue;
      if (key.startsWith("origin:")) {
        originFields[key.slice("origin:".length)] = value;
      } else if (key.startsWith("var_")) {
        customFields[key] = value;
      }
    }

    const tagsRaw = mapping.tags ? String(row[mapping.tags] || "") : "";
    return {
      name: String(row[mapping.name || ""] || "").trim(),
      phone: String(row[mapping.phone || ""] || "").trim(),
      tags: parseTags(tagsRaw),
      customFields,
      originFields: Object.keys(originFields).length ? originFields : undefined,
      raw: row,
      rowIndex,
    };
  });
}

export function validateSpreadsheetRows(
  rows: MappedSpreadsheetRow[],
  requireName = false
): SpreadsheetValidation {
  const seen = new Map<string, number>();
  const duplicatePhoneList: string[] = [];
  const invalidPhones: string[] = [];
  let valid = 0;
  let invalid = 0;
  let emptyName = 0;

  for (const row of rows) {
    if (!row.phone) {
      invalid++;
      continue;
    }

    let normalized: string;
    try {
      normalized = normalizePhone(row.phone);
    } catch {
      invalid++;
      invalidPhones.push(row.phone);
      continue;
    }

    if (!row.name && requireName) emptyName++;

    const prev = seen.get(normalized);
    if (prev !== undefined) {
      duplicatePhoneList.push(normalized);
    } else {
      seen.set(normalized, row.rowIndex);
    }

    valid++;
  }

  return {
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    duplicatePhones: duplicatePhoneList.length,
    emptyName,
    invalidPhones: invalidPhones.slice(0, 10),
    duplicatePhoneList: [...new Set(duplicatePhoneList)].slice(0, 10),
  };
}

export function getSpreadsheetColumnOptions(
  mapping: Record<string, string>
): Array<{ key: string; label: string }> {
  return Object.entries(mapping)
    .filter(
      ([key, col]) =>
        col && (key.startsWith("var_") || key.startsWith("origin:"))
    )
    .map(([key, col]) => ({
      key: key.startsWith("origin:") ? key : key,
      label: key.startsWith("origin:")
        ? `Origem: ${col}`
        : `Coluna: ${col}`,
    }));
}
