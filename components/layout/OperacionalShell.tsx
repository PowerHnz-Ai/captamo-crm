"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface OperacionalShellProps {
  children: ReactNode;
}

export function OperacionalShell({ children }: OperacionalShellProps) {
  return (
    <div className="relative flex h-screen overflow-hidden">
      <div className="mesh-bg" aria-hidden />
      <div className="relative z-10 flex min-h-0 w-full">
        <Sidebar mode="operacional" />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

/** @deprecated Use OperacionalShell */
export const ChatShell = OperacionalShell;
