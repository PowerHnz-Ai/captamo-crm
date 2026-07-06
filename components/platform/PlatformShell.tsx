"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { UltraWordmark } from "@/components/brand/UltraWordmark";

/**
 * Shell mínimo do painel da plataforma (super admin) — sem a sidebar do CRM.
 */
export function PlatformShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const { profile, logout } = useAuth();

  return (
    <div className="relative min-h-screen">
      <div className="mesh-bg" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-6 md:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UltraWordmark variant="hub" size="md" />
            <span className="flex items-center gap-1.5 rounded-full bg-app-accent/15 px-3 py-1 text-xs font-semibold text-app-accent">
              <ShieldCheck className="h-3.5 w-3.5" />
              Plataforma
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-app-muted">{profile?.email}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-2 text-app-muted transition hover:text-app-text"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </header>

        {(title || subtitle) && (
          <div className="mb-6">
            {title && (
              <h1 className="font-display text-2xl font-semibold text-app-text">
                {title}
              </h1>
            )}
            {subtitle && <p className="mt-1 text-sm text-app-subtle">{subtitle}</p>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
