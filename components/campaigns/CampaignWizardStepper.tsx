"use client";

import { Check } from "lucide-react";
import {
  WIZARD_STEPS,
  type CampaignWizardStep,
} from "@/components/campaigns/campaign-wizard-types";

interface CampaignWizardStepperProps {
  currentStep: CampaignWizardStep;
  maxReachedStep: CampaignWizardStep;
  onStepClick: (step: CampaignWizardStep) => void;
}

export function CampaignWizardStepper({
  currentStep,
  maxReachedStep,
  onStepClick,
}: CampaignWizardStepperProps) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-app-secondary/60 p-1">
      {WIZARD_STEPS.map((step) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        const canNavigate = step.id <= maxReachedStep;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!canNavigate}
            onClick={() => canNavigate && onStepClick(step.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
              isActive
                ? "bg-app-card text-app-text shadow-sm"
                : canNavigate
                  ? "text-app-muted hover:text-app-text"
                  : "cursor-not-allowed text-app-muted/50"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold ${
                isCompleted
                  ? "bg-emerald-500/20 text-emerald-300"
                  : isActive
                    ? "bg-app-accent/20 text-app-accent"
                    : "bg-white/5 text-app-muted"
              }`}
            >
              {isCompleted ? <Check className="h-3 w-3" /> : step.id + 1}
            </span>
            <span className="hidden truncate sm:inline">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
