"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ContactOrigin, Template } from "@/lib/types";

interface CampaignSetupStepProps {
  form: { name: string; templateName: string };
  onFormChange: (patch: Partial<{ name: string; templateName: string }>) => void;
  approvedTemplates: Template[];
  contactOriginId: string;
  onContactOriginChange: (id: string) => void;
  origins: ContactOrigin[];
  selectedOrigin: ContactOrigin | null;
  isEdit: boolean;
}

export function CampaignSetupStep({
  form,
  onFormChange,
  approvedTemplates,
  contactOriginId,
  onContactOriginChange,
  origins,
  selectedOrigin,
  isEdit,
}: CampaignSetupStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-app-text">Configuração da campanha</h3>
        <p className="mt-1 text-sm text-app-muted">
          Defina o nome, o template aprovado e a origem dos contatos.
        </p>
      </div>

      <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            id="camp-name"
            label="Nome"
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-app-subtle">
              Template aprovado
            </label>
            <Select
              value={form.templateName}
              onChange={(e) => onFormChange({ templateName: e.target.value })}
              required
            >
              {approvedTemplates.length === 0 ? (
                <option value="">Nenhum template aprovado</option>
              ) : (
                approvedTemplates.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))
              )}
            </Select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-app-subtle">
              Tipo de origem da campanha
            </label>
            <Select
              value={contactOriginId}
              onChange={(e) => onContactOriginChange(e.target.value)}
            >
              <option value="">Nenhuma (campanha genérica)</option>
              {origins.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            {selectedOrigin && (
              <p className="mt-1.5 text-xs text-app-muted">
                Campos disponíveis:{" "}
                {selectedOrigin.fields.map((f) => f.label).join(", ") || "—"}
              </p>
            )}
            {!isEdit && contactOriginId && (
              <p className="mt-1 text-xs text-app-subtle">
                Na próxima etapa você poderá filtrar contatos por esta origem.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
