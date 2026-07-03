"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CampaignParameterMapper,
  type ParameterMappingValue,
} from "@/components/campaigns/CampaignParameterMapper";
import {
  CampaignHeaderImageSection,
  type HeaderImageMode,
} from "@/components/campaigns/CampaignHeaderImageSection";
import type { MediaLibrarySelection } from "@/components/media/MediaLibraryPicker";
import type { MappedSpreadsheetRow } from "@/lib/campaign-spreadsheet";
import type { Template } from "@/lib/types";

interface CampaignMessageStepProps {
  selectedTemplate: Template | undefined;
  templateVarCount: number;
  paramValues: ParameterMappingValue[];
  onParamValuesChange: (values: ParameterMappingValue[]) => void;
  columnOptions: Array<{ key: string; label: string }>;
  originFieldOptions: Array<{ key: string; label: string }>;
  sampleRow: MappedSpreadsheetRow | null;
  showHeaderImage: boolean;
  headerImageMode: HeaderImageMode;
  onHeaderImageModeChange: (mode: HeaderImageMode) => void;
  headerImageSelection: MediaLibrarySelection | null;
  onHeaderImageSelectionChange: (selection: MediaLibrarySelection | null) => void;
  headerImageMapping: string;
  onHeaderImageMappingChange: (mapping: string) => void;
  headerMappingOptions: Array<{ value: string; label: string }>;
  testPhone: string;
  onTestPhoneChange: (phone: string) => void;
  onTestSend: () => void;
  testing: boolean;
  creating: boolean;
}

export function CampaignMessageStep({
  selectedTemplate,
  templateVarCount,
  paramValues,
  onParamValuesChange,
  columnOptions,
  originFieldOptions,
  sampleRow,
  showHeaderImage,
  headerImageMode,
  onHeaderImageModeChange,
  headerImageSelection,
  onHeaderImageSelectionChange,
  headerImageMapping,
  onHeaderImageMappingChange,
  headerMappingOptions,
  testPhone,
  onTestPhoneChange,
  onTestSend,
  testing,
  creating,
}: CampaignMessageStepProps) {
  const hasContent = templateVarCount > 0 || showHeaderImage;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-app-text">Conteúdo da mensagem</h3>
        <p className="mt-1 text-sm text-app-muted">
          Configure variáveis, imagem de cabeçalho e envie um teste antes de disparar.
        </p>
      </div>

      {!hasContent && (
        <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">
          <p className="text-sm text-app-muted">
            Este template não possui variáveis nem cabeçalho de imagem. Você pode enviar um
            teste opcional abaixo.
          </p>
        </div>
      )}

      {selectedTemplate && templateVarCount > 0 && (
        <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">
          <CampaignParameterMapper
            template={selectedTemplate}
            values={paramValues}
            onChange={onParamValuesChange}
            columnOptions={columnOptions}
            originFieldOptions={originFieldOptions}
            sampleRow={sampleRow}
          />
        </div>
      )}

      {showHeaderImage && (
        <CampaignHeaderImageSection
          mode={headerImageMode}
          onModeChange={onHeaderImageModeChange}
          selection={headerImageSelection}
          onSelectionChange={onHeaderImageSelectionChange}
          mapping={headerImageMapping}
          onMappingChange={onHeaderImageMappingChange}
          mappingOptions={headerMappingOptions}
          disabled={creating}
        />
      )}

      <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">
        <h4 className="mb-3 text-sm font-medium text-app-subtle">Envio de teste</h4>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              id="camp-test-phone"
              label="Telefone para teste"
              value={testPhone}
              onChange={(e) => onTestPhoneChange(e.target.value)}
              placeholder="5511999999999"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={testing}
            onClick={onTestSend}
            className="shrink-0"
          >
            Enviar teste
          </Button>
        </div>
      </div>
    </div>
  );
}
