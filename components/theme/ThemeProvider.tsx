"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api-fetch";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  hexToRgba,
  sanitizePreferences,
  shadeHex,
} from "@/lib/preferences";
import type { UserPreferences } from "@/lib/types";

interface ThemeContextValue {
  preferences: UserPreferences;
  setPreferences: (next: Partial<UserPreferences>) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Evento disparado pelo AuthProvider quando o perfil é carregado. */
export const AUTH_READY_EVENT = "ultra-auth-ready";

function resolveTheme(theme: UserPreferences["theme"]): "dark" | "light" {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    return "dark";
  }
  return theme;
}

function applyPreferences(prefs: UserPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolveTheme(prefs.theme));
  root.setAttribute("data-font-size", prefs.fontSize);
  root.style.setProperty("--accent", prefs.accent);
  root.style.setProperty("--accent-hover", shadeHex(prefs.accent, 0.18));
  root.style.setProperty("--accent-soft", hexToRgba(prefs.accent, 0.15));
}

function readCache(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return sanitizePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;

  // Boot: lê o cache do localStorage e aplica imediatamente.
  useEffect(() => {
    const cached = readCache();
    setPreferencesState(cached);
    applyPreferences(cached);
    setReady(true);
  }, []);

  // Reaplica quando o tema do sistema muda (somente no modo "system").
  useEffect(() => {
    if (preferences.theme !== "system" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyPreferences(prefsRef.current);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preferences.theme]);

  const syncFromServer = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/preferences");
      if (!res.ok) return;
      const data = (await res.json()) as { preferences?: UserPreferences };
      if (data.preferences) {
        const sane = sanitizePreferences(data.preferences);
        setPreferencesState(sane);
        applyPreferences(sane);
        window.localStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify(sane)
        );
      }
    } catch {
      // sem rede/login — mantém cache local
    }
  }, []);

  // Sincroniza com o servidor após o login.
  useEffect(() => {
    const handler = () => void syncFromServer();
    window.addEventListener(AUTH_READY_EVENT, handler);
    return () => window.removeEventListener(AUTH_READY_EVENT, handler);
  }, [syncFromServer]);

  const setPreferences = useCallback((next: Partial<UserPreferences>) => {
    setPreferencesState((prev) => {
      const merged = sanitizePreferences({ ...prev, ...next });
      applyPreferences(merged);
      try {
        window.localStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify(merged)
        );
      } catch {
        // ignore
      }
      void apiFetch("/api/me/preferences", {
        method: "PUT",
        body: JSON.stringify(merged),
      }).catch(() => {
        // salvar offline; cache local mantém o estado
      });
      return merged;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ preferences, setPreferences, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  }
  return ctx;
}
