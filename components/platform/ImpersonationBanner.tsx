"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
import { useImpersonation } from "@/hooks/useImpersonation";
import { stopImpersonation } from "@/lib/impersonation";

/**
 * Barra fixa mostrada em todas as telas enquanto o platform admin está
 * atuando dentro do painel de uma clínica. Renderiza um spacer da própria
 * altura para não cobrir o conteúdo.
 */
export function ImpersonationBanner() {
  const impersonation = useImpersonation();
  const router = useRouter();
  const pathname = usePathname();

  if (!impersonation || pathname.startsWith("/platform")) return null;

  function exitImpersonation() {
    stopImpersonation();
    router.replace("/platform");
  }

  return (
    <>
      <div className="h-10" aria-hidden />
      <div className="fixed inset-x-0 top-0 z-[200] flex h-10 items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-950/95 px-4 text-sm text-amber-200 backdrop-blur">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
        <span className="truncate">
          Você está no painel da clínica{" "}
          <strong className="font-semibold text-amber-100">
            {impersonation.companyName}
          </strong>{" "}
          ({impersonation.companyId})
        </span>
        <button
          type="button"
          onClick={exitImpersonation}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </>
  );
}
