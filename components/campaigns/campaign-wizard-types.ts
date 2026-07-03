export type CampaignWizardStep = 0 | 1 | 2 | 3;

export type AudienceMode =
  | "all"
  | "tags"
  | "classes"
  | "upload"
  | "origin"
  | "keep";

export const WIZARD_STEPS: Array<{ id: CampaignWizardStep; label: string }> = [
  { id: 0, label: "Configuração" },
  { id: 1, label: "Público" },
  { id: 2, label: "Mensagem" },
  { id: 3, label: "Envio" },
];
