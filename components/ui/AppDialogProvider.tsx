"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  registerAppDialog,
  resolveAppDialog,
  type AppDialogState,
  type AppDialogVariant,
} from "@/lib/app-dialog";

const variantStyles: Record<
  AppDialogVariant,
  { icon: typeof Info; iconClass: string; ring: string }
> = {
  default: {
    icon: Info,
    iconClass: "text-app-accent bg-app-accent/15",
    ring: "border-app-accent/30",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-400 bg-emerald-500/15",
    ring: "border-emerald-500/30",
  },
  error: {
    icon: AlertCircle,
    iconClass: "text-red-400 bg-red-500/15",
    ring: "border-red-500/30",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-400 bg-amber-500/15",
    ring: "border-amber-500/30",
  },
};

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<AppDialogState | null>(null);

  useEffect(() => registerAppDialog(setDialog), []);

  useEffect(() => {
    if (!dialog?.open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        resolveAppDialog(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialog?.open]);

  const style = dialog ? variantStyles[dialog.variant] : null;
  const Icon = style?.icon;

  return (
    <>
      {children}

      {dialog?.open && style && Icon && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Fechar"
            onClick={() => resolveAppDialog(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            aria-describedby="app-dialog-message"
            className={`relative z-10 w-full max-w-md rounded-2xl border bg-app-card p-6 shadow-2xl ${style.ring}`}
          >
            <div className="mb-4 flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconClass}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2
                  id="app-dialog-title"
                  className="font-display text-lg font-semibold text-app-text"
                >
                  {dialog.title}
                </h2>
                <p
                  id="app-dialog-message"
                  className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-app-subtle"
                >
                  {dialog.message}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {dialog.mode === "confirm" && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => resolveAppDialog(false)}
                >
                  {dialog.cancelLabel}
                </Button>
              )}
              <Button
                type="button"
                variant={dialog.destructive ? "danger" : "primary"}
                onClick={() => resolveAppDialog(true)}
              >
                {dialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
