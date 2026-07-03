"use client";

import { Button } from "@/components/ui/Button";
import {
  CampaignDispatchModeSection,
  type DispatchFormState,
} from "@/components/campaigns/CampaignDispatchMode";
import { CampaignValidationReport } from "@/components/campaigns/CampaignValidationReport";
import type { SpreadsheetImportState } from "@/components/campaigns/CampaignSpreadsheetImport";

interface CampaignDispatchStepProps {
  dispatch: DispatchFormState;
  onDispatchChange: (state: DispatchFormState) => void;
  estimatedAudienceCount: number;
  preview: {
    audienceCount: number;
    excludedRecentCount?: number;
    excludedTagsCount?: number;
    excludedClassesCount?: number;
    invalidCount?: number;
    renderedSamples?: string[];
  } | null;
  spreadsheet: SpreadsheetImportState;
  lastImportStats: {
    created: number;
    updated: number;
    skipped: number;
  } | null;
  previewing: boolean;
  onPreview: () => void;
}

export function CampaignDispatchStep({
  dispatch,
  onDispatchChange,
  estimatedAudienceCount,
  preview,
  spreadsheet,
  lastImportStats,
  previewing,
  onPreview,
}: CampaignDispatchStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-app-text">Envio e revisão</h3>
        <p className="mt-1 text-sm text-app-muted">
          Defina como e quando a campanha será disparada e revise o resumo antes de criar.
        </p>
      </div>

      <div className="rounded-xl border border-app-border bg-app-secondary/30 p-4">
        <CampaignDispatchModeSection
          state={dispatch}
          onChange={onDispatchChange}
          totalContacts={estimatedAudienceCount || 0}
        />
      </div>

      <div className="rounded-xl border border-app-accent/30 bg-app-accent/5 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-app-text">Resumo da campanha</h4>
          <Button
            type="button"
            variant="secondary"
            loading={previewing}
            onClick={onPreview}
            className="h-9 px-3 text-sm"
          >
            Preview audiência
          </Button>
        </div>
        <CampaignValidationReport
          audienceCount={preview?.audienceCount ?? estimatedAudienceCount ?? 0}
          excludedRecentCount={preview?.excludedRecentCount}
          excludedTagsCount={preview?.excludedTagsCount}
          excludedClassesCount={preview?.excludedClassesCount}
          spreadsheetValidation={spreadsheet.validation}
          invalidCount={preview?.invalidCount}
          renderedSamples={preview?.renderedSamples}
          importStats={lastImportStats ?? undefined}
        />
      </div>
    </div>
  );
}
