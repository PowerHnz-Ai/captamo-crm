import type { ParameterMappingValue } from "@/components/campaigns/CampaignParameterMapper";
import type { HeaderImageMode } from "@/components/campaigns/CampaignHeaderImageSection";
import type { MediaLibrarySelection } from "@/components/media/MediaLibraryPicker";
import type { SpreadsheetImportState } from "@/components/campaigns/CampaignSpreadsheetImport";
import type { CampaignWizardStep, AudienceMode } from "@/components/campaigns/campaign-wizard-types";

export interface WizardValidationInput {
  step: CampaignWizardStep;
  form: { name: string; templateName: string };
  audienceMode: AudienceMode;
  selectedTags: string[];
  selectedLeadClasses: number[];
  spreadsheet: SpreadsheetImportState;
  contactOriginId: string;
  templateVarCount: number;
  paramValues: ParameterMappingValue[];
  showHeaderImage: boolean;
  headerImageMode: HeaderImageMode;
  headerImageSelection: MediaLibrarySelection | null;
  headerImageMapping: string;
}

export function validateWizardStep(input: WizardValidationInput): string | null {
  switch (input.step) {
    case 0: {
      if (!input.form.name.trim()) return "Informe o nome da campanha.";
      if (!input.form.templateName) return "Selecione um template aprovado.";
      return null;
    }
    case 1: {
      switch (input.audienceMode) {
        case "keep":
        case "all":
          return null;
        case "origin":
          if (!input.contactOriginId) {
            return "Selecione uma origem na etapa de configuração ou escolha outro público.";
          }
          return null;
        case "tags":
          if (input.selectedTags.length === 0) {
            return "Selecione ao menos uma tag.";
          }
          return null;
        case "classes":
          if (input.selectedLeadClasses.length === 0) {
            return "Selecione ao menos uma classe de lead.";
          }
          return null;
        case "upload":
          if (!input.spreadsheet.ready) {
            return "Envie e mapeie uma planilha válida.";
          }
          return null;
        default:
          return null;
      }
    }
    case 2: {
      if (input.templateVarCount > 0) {
        for (let i = 0; i < input.paramValues.length; i++) {
          const v = input.paramValues[i]!;
          if (v.type === "literal" && !v.value.trim()) {
            return `Preencha o texto fixo da variável {{${i + 1}}}.`;
          }
        }
      }
      if (input.showHeaderImage) {
        if (input.headerImageMode === "fixed" && !input.headerImageSelection) {
          return "Selecione uma imagem para o cabeçalho do template.";
        }
        if (input.headerImageMode === "per_contact" && !input.headerImageMapping) {
          return "Defina o mapeamento da imagem por contato.";
        }
      }
      return null;
    }
    case 3:
      return null;
    default:
      return null;
  }
}
