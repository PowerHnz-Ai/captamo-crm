// Estimativa por categoria de template (USD por mensagem enviada).
// Sobrescreva via env ou companies/{id}.campaignUnitCosts.

const DEFAULT_COSTS: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0068,
  AUTHENTICATION: 0.0068,
};

function parseEnvCost(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeCategory(category?: string): string {
  return (category || "MARKETING").toUpperCase();
}

export function getCampaignUnitCost(
  category?: string,
  companyOverrides?: Record<string, number>
): number {
  const key = normalizeCategory(category);
  if (companyOverrides?.[key] != null) {
    return companyOverrides[key];
  }

  const envKey = `CAMPAIGN_COST_${key}_USD`;
  return parseEnvCost(envKey, DEFAULT_COSTS[key] ?? DEFAULT_COSTS.MARKETING);
}

export function estimateCampaignSpend(sentCount: number, category?: string): number {
  const unit = getCampaignUnitCost(category);
  return Math.round(sentCount * unit * 10000) / 10000;
}

export function formatUSD(value: number): string {
  const decimals = value > 0 && value < 0.1 ? 4 : 2;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCategoryLabel(category?: string): string {
  const key = normalizeCategory(category);
  const labels: Record<string, string> = {
    MARKETING: "Marketing",
    UTILITY: "Utilidade",
    AUTHENTICATION: "Autenticação",
  };
  return labels[key] || key;
}
