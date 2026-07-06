"use client";

import { useEffect, useState } from "react";
import {
  getImpersonation,
  IMPERSONATION_EVENT,
  type ImpersonationState,
} from "@/lib/impersonation";

/**
 * Estado de impersonação (platform admin atuando como clínica). O primeiro
 * render é sempre null (server e client) — a leitura do sessionStorage
 * acontece no effect, sem risco de hydration mismatch.
 */
export function useImpersonation(): ImpersonationState | null {
  const [state, setState] = useState<ImpersonationState | null>(null);

  useEffect(() => {
    const sync = () => setState(getImpersonation());
    sync();
    window.addEventListener(IMPERSONATION_EVENT, sync);
    return () => window.removeEventListener(IMPERSONATION_EVENT, sync);
  }, []);

  return state;
}
