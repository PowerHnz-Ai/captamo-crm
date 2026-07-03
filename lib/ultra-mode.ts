export type UltraMode = "crm" | "api" | "operacional";

const STORAGE_KEY = "ultraMode";

export function normalizeUltraMode(value: string | null): UltraMode | null {
  if (value === "crm" || value === "api" || value === "operacional") return value;
  return null;
}

export function isApiMode(mode: UltraMode | null): boolean {
  return mode === "crm" || mode === "api";
}

export function getUltraMode(): UltraMode | null {
  if (typeof window === "undefined") return null;
  return normalizeUltraMode(localStorage.getItem(STORAGE_KEY));
}

export function setUltraMode(mode: UltraMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function clearUltraMode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
