import type {
  FontSizePreference,
  ThemePreference,
  UserPreferences,
} from "./types";

export const ACCENT_PRESETS: Array<{ value: string; label: string }> = [
  { value: "#2e9ee5", label: "Captamo" },
  { value: "#d9c07e", label: "Dourado" },
  { value: "#10b981", label: "Esmeralda" },
  { value: "#8b5cf6", label: "Roxo" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#f59e0b", label: "Âmbar" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#0ea5e9", label: "Ciano" },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  accent: "#2e9ee5",
  fontSize: "medium",
};

const THEME_VALUES: ThemePreference[] = ["dark", "light", "system"];
const FONT_SIZE_VALUES: FontSizePreference[] = ["small", "medium", "large", "xlarge"];
const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function sanitizePreferences(
  input: Partial<UserPreferences> | null | undefined
): UserPreferences {
  const theme =
    input?.theme && THEME_VALUES.includes(input.theme)
      ? input.theme
      : DEFAULT_PREFERENCES.theme;
  const fontSize =
    input?.fontSize && FONT_SIZE_VALUES.includes(input.fontSize)
      ? input.fontSize
      : DEFAULT_PREFERENCES.fontSize;
  const accent =
    input?.accent && HEX_RE.test(input.accent)
      ? input.accent.toLowerCase()
      : DEFAULT_PREFERENCES.accent;
  return { theme, accent, fontSize };
}

/** Clareia/escurece uma cor hex por um fator (-1 a 1). */
export function shadeHex(hex: string, percent: number): string {
  const m = HEX_RE.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1]!, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const m = HEX_RE.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1]!, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const PREFERENCES_STORAGE_KEY = "ultra-preferences";
