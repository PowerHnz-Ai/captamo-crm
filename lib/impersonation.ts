// Estado de impersonação: platform admin atuando como uma clínica.
// Módulo isomórfico — o server importa apenas as constantes; as funções de
// storage só operam no browser (guards de typeof window).

export const IMPERSONATION_HEADER = "x-platform-company-id";
export const IMPERSONATION_STORAGE_KEY = "ultra-impersonation";
export const IMPERSONATION_EVENT = "ultra-impersonation-changed";

export interface ImpersonationState {
  companyId: string;
  companyName: string;
  startedAt: number;
}

export function getImpersonation(): ImpersonationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpersonationState;
    if (!parsed?.companyId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function startImpersonation(state: ImpersonationState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(IMPERSONATION_EVENT));
}

export function stopImpersonation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(IMPERSONATION_EVENT));
}
