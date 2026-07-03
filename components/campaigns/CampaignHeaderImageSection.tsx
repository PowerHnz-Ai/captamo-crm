"use client";

import { Select } from "@/components/ui/Select";
import {
  MediaLibraryPicker,
  type MediaLibrarySelection,
} from "@/components/media/MediaLibraryPicker";

export type HeaderImageMode = "fixed" | "per_contact";

interface HeaderImageMappingOption {
  value: string;
  label: string;
}

interface CampaignHeaderImageSectionProps {
  mode: HeaderImageMode;
  onModeChange: (mode: HeaderImageMode) => void;
  selection: MediaLibrarySelection | null;
  onSelectionChange: (selection: MediaLibrarySelection | null) => void;
  mapping: string;
  onMappingChange: (mapping: string) => void;
  mappingOptions: HeaderImageMappingOption[];
  disabled?: boolean;
}

export function CampaignHeaderImageSection({
  mode,
  onModeChange,
  selection,
  onSelectionChange,
  mapping,
  onMappingChange,
  mappingOptions,
  disabled,
}: CampaignHeaderImageSectionProps) {
  return (
    <div className="space-y-3 rounded-xl border border-app-border p-4">
      <h4 className="font-medium text-app-text">Imagem do cabeçalho</h4>
      <p className="text-sm text-app-subtle">
        O template selecionado usa cabeçalho IMAGE. Escolha a imagem enviada no
        disparo.
      </p>

      <Select
        id="header-image-mode"
        label="Modo"
        value={mode}
        disabled={disabled}
        onChange={(e) => onModeChange(e.target.value as HeaderImageMode)}
      >
        <option value="fixed">Imagem fixa para toda a campanha</option>
        <option value="per_contact">Imagem por contato (origem/planilha)</option>
      </Select>

      {mode === "fixed" ? (
        <MediaLibraryPicker
          source="campaign"
          value={selection}
          onChange={onSelectionChange}
          disabled={disabled}
        />
      ) : (
        <Select
          id="header-image-mapping"
          label="Origem da imagem por contato"
          value={mapping}
          disabled={disabled || mappingOptions.length === 0}
          onChange={(e) => onMappingChange(e.target.value)}
        >
          <option value="">Selecione...</option>
          {mappingOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

export function buildHeaderImageMappingOptions(params: {
  originFieldOptions: Array<{ key: string; label: string }>;
  columnOptions: Array<{ key: string; label: string }>;
  assets: Array<{ id: string; name: string }>;
}): HeaderImageMappingOption[] {
  const options: HeaderImageMappingOption[] = [];

  for (const field of params.originFieldOptions) {
    options.push({
      value: `origin:${field.key}`,
      label: `Origem — ${field.label}`,
    });
  }

  for (const col of params.columnOptions) {
    options.push({
      value: `column:${col.key}`,
      label: `Planilha — ${col.label}`,
    });
  }

  for (const asset of params.assets) {
    options.push({
      value: `asset:${asset.id}`,
      label: `Biblioteca — ${asset.name}`,
    });
  }

  return options;
}
