import type { ContactOrigin, ContactOriginField } from "./types";

export type SuggestedParameterMappingValue =
  | { type: "first_name" }
  | { type: "phone" }
  | { type: "literal_today" }
  | { type: "literal"; value: string }
  | { type: "column"; key: string; label: string }
  | { type: "origin"; key: string; label: string };

/** Primeiro campo não-mês da origem, usado como default para {{1}}. */
function primaryOriginFieldKey(origin: ContactOrigin): string | null {
  const field =
    origin.fields.find((f) => f.type !== "month") ||
    origin.fields[0];
  return field?.key ?? null;
}

export function suggestParameterValuesForOrigin(
  origin: ContactOrigin | null | undefined,
  variableCount: number
): SuggestedParameterMappingValue[] {
  if (variableCount <= 0) return [];

  const primaryKey = origin ? primaryOriginFieldKey(origin) : null;

  return Array.from({ length: variableCount }, (_, i) => {
    if (i === 0) {
      if (primaryKey) {
        const field = origin!.fields.find((f) => f.key === primaryKey)!;
        return {
          type: "origin" as const,
          key: field.key,
          label: field.label,
        };
      }
      return { type: "first_name" as const };
    }
    const monthField = origin?.fields.find((f) => f.type === "month");
    if (monthField && i === 1) {
      return {
        type: "origin" as const,
        key: monthField.key,
        label: monthField.label,
      };
    }
    return { type: "literal" as const, value: "" };
  });
}

export function originFieldOptionsForOrigin(
  origin: ContactOrigin | null | undefined
): Array<{ key: string; label: string }> {
  if (!origin) return [];
  return origin.fields.map((f) => ({
    key: f.key,
    label: f.label,
  }));
}

export function buildOriginSpreadsheetFields(
  origin: ContactOrigin | null | undefined
): Array<{ key: string; label: string; required?: boolean }> {
  if (!origin) return [];
  return origin.fields.map((f) => ({
    key: `origin:${f.key}`,
    label: f.label,
    required: f.required,
  }));
}

export function contactRefFieldKeysFromOrigin(
  origin: ContactOrigin | null | undefined
): Set<string> {
  if (!origin) return new Set();
  return new Set(
    origin.fields.filter((f) => f.type === "contact_ref").map((f) => f.key)
  );
}
