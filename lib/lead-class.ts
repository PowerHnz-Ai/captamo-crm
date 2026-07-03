export const LEAD_CLASSES = [
  {
    value: 1,
    label: "Classe 1",
    description: "Lead qualificado com interesse em avaliação",
  },
  {
    value: 2,
    label: "Classe 2",
    description: "Tem interesse, mas não agora",
  },
  {
    value: 3,
    label: "Classe 3",
    description: "Lead ativo frio — respondeu, sem interesse no momento",
  },
  {
    value: 4,
    label: "Classe 4",
    description: "Sem interesse",
  },
  {
    value: 5,
    label: "Classe 5",
    description: "Bloqueado / sem interesse nosso",
  },
] as const;

export type LeadClassValue = (typeof LEAD_CLASSES)[number]["value"];

export function leadClassLabel(value: number | undefined | null): string {
  if (!value) return "Sem classe";
  const found = LEAD_CLASSES.find((c) => c.value === value);
  return found ? `${found.label} — ${found.description}` : `Classe ${value}`;
}

export function leadClassShortLabel(value: number | undefined | null): string {
  if (!value) return "Sem classe";
  const found = LEAD_CLASSES.find((c) => c.value === value);
  return found ? found.label : `Classe ${value}`;
}
