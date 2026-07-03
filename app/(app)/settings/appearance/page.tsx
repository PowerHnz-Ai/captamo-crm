"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/components/theme/ThemeProvider";
import { ACCENT_PRESETS } from "@/lib/preferences";
import type {
  FontSizePreference,
  ThemePreference,
} from "@/lib/types";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
];

const FONT_OPTIONS: Array<{ value: FontSizePreference; label: string }> = [
  { value: "small", label: "Pequena" },
  { value: "medium", label: "Média" },
  { value: "large", label: "Grande" },
  { value: "xlarge", label: "Extra grande" },
];

export default function AppearanceSettingsPage() {
  const { preferences, setPreferences } = useTheme();

  return (
    <AppShell
      title="Aparência"
      subtitle="Personalize tema, cor de destaque e tamanho de fonte. As preferências ficam salvas na sua conta."
    >
      <div className="max-w-2xl space-y-6">
        <Card className="p-6">
          <h3 className="text-base font-semibold">Tema</h3>
          <p className="mt-1 text-sm text-app-subtle">
            Escolha entre claro, escuro ou seguir o sistema.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = preferences.theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreferences({ theme: opt.value })}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                    active
                      ? "border-app-accent bg-app-accent/10 text-app-text"
                      : "border-app-border bg-app-secondary/40 text-app-subtle hover:border-app-accent/40"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-base font-semibold">Cor de destaque</h3>
          <p className="mt-1 text-sm text-app-subtle">
            Aplica-se a botões, links e elementos ativos.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {ACCENT_PRESETS.map((preset) => {
              const active = preferences.accent === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  onClick={() => setPreferences({ accent: preset.value })}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
                    active ? "border-app-text" : "border-transparent"
                  }`}
                  style={{ backgroundColor: preset.value }}
                >
                  {active && <Check className="h-5 w-5 text-white" />}
                </button>
              );
            })}
            <label
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-app-border text-app-muted hover:border-app-accent/50"
              title="Cor personalizada"
            >
              <input
                type="color"
                value={preferences.accent}
                onChange={(e) => setPreferences({ accent: e.target.value })}
                className="h-0 w-0 opacity-0"
              />
              +
            </label>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-base font-semibold">Tamanho da fonte</h3>
          <p className="mt-1 text-sm text-app-subtle">
            Ajusta a escala de texto em toda a interface.
          </p>
          <div className="mt-4 inline-flex rounded-xl border border-app-border bg-app-secondary/40 p-1">
            {FONT_OPTIONS.map((opt) => {
              const active = preferences.fontSize === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreferences({ fontSize: opt.value })}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-app-accent text-white"
                      : "text-app-subtle hover:text-app-text"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
