"use client";

import { Input } from "@/components/ui/Input";
import type { ContactOrigin } from "@/lib/types";

interface ContactOriginFieldsProps {
  origin: ContactOrigin | null | undefined;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  disabled?: boolean;
  idPrefix?: string;
}

export function ContactOriginFields({
  origin,
  values,
  onChange,
  disabled = false,
  idPrefix = "origin",
}: ContactOriginFieldsProps) {
  if (!origin?.fields.length) return null;

  function updateField(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  return (
    <>
      {origin.fields.map((field) => (
        <div key={field.key}>
          {field.type === "month" ? (
            <Input
              id={`${idPrefix}-${field.key}`}
              label={field.label}
              type="month"
              value={values[field.key] || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              required={field.required}
              disabled={disabled}
            />
          ) : (
            <Input
              id={`${idPrefix}-${field.key}`}
              label={field.label}
              type={field.type === "phone" ? "tel" : "text"}
              value={values[field.key] || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              required={field.required}
              disabled={disabled}
              placeholder={
                field.type === "contact_ref"
                  ? "Nome, telefone ou ID do contato"
                  : undefined
              }
            />
          )}
        </div>
      ))}
    </>
  );
}
