/** Helpers de audiência seguros para componentes client (sem firebase-admin). */

export function describeAudienceType(
  audienceType?: string,
  audienceConfig?: {
    tags?: string[];
    contactListId?: string;
    spreadsheetTag?: string;
    originId?: string;
  },
  originLabel?: string
): string {
  switch (audienceType) {
    case "origin":
      return originLabel
        ? `Origem: ${originLabel}`
        : audienceConfig?.originId
          ? "Por origem"
          : "Por origem";
    case "spreadsheet":
      return audienceConfig?.spreadsheetTag
        ? `Planilha (tag: ${audienceConfig.spreadsheetTag})`
        : "Planilha";
    case "tags":
      return audienceConfig?.tags?.length
        ? `Tags: ${audienceConfig.tags.join(", ")}`
        : "Por tags";
    case "list":
      return "Por lista";
    case "manual":
      return "Seleção manual";
    case "all":
    default:
      return "Todos que autorizaram campanhas";
  }
}

export function describeExcludeRecentDays(excludeRecentDays?: number): string | null {
  if (!excludeRecentDays || excludeRecentDays < 1) return null;
  return `Exclui contatos dos últimos ${excludeRecentDays} dias`;
}
