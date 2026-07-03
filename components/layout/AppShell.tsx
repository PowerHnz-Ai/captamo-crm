"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { usePermissions } from "@/hooks/usePermissions";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { UltraMode } from "@/lib/ultra-mode";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  mode?: UltraMode;
  fullBleed?: boolean;
  hideHeader?: boolean;
}

export function AppShell({
  children,
  title,
  subtitle,
  mode = "crm",
  fullBleed = false,
  hideHeader = false,
}: AppShellProps) {
  const { can } = usePermissions();
  const [onlineCount, setOnlineCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!can("team.view_online")) return;

    const load = () => {
      apiFetch("/api/presence")
        .then((res) => parseApiJson<{ onlineCount?: number }>(res))
        .then((data) => {
          if (typeof data.onlineCount === "number") setOnlineCount(data.onlineCount);
        })
        .catch(() => {
          // ignore
        });
    };

    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [can]);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <div className="mesh-bg" aria-hidden />
      <div className="relative z-10 flex min-h-0 w-full">
        <Sidebar mode={mode} onlineCount={onlineCount} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!hideHeader && title && (
            <header className="shrink-0 border-b border-app-border px-4 py-4 md:px-6">
              <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 text-sm text-app-subtle">{subtitle}</p>
              )}
            </header>
          )}
      <div
        className={`min-h-0 flex-1 ${
          fullBleed ? "overflow-hidden" : "overflow-auto p-4 md:p-6"
        }`}
      >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
