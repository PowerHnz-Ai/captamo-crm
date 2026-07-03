import type { SelectHTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
  /** Tamanho compacto para barras de filtro. */
  compact?: boolean;
}

export function Select({
  label,
  children,
  className = "",
  compact = false,
  id,
  ...props
}: SelectProps) {
  const base = compact
    ? "h-9 rounded-lg pl-2.5 pr-8 text-xs"
    : "h-11 rounded-xl pl-3 pr-9 text-sm";

  return (
    <div className={label ? "space-y-1.5" : ""}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-app-subtle">
          {label}
        </label>
      )}
      <div className={`relative ${compact ? "inline-flex w-auto" : "flex w-full"}`}>
        <select
          id={id}
          className={`ultra-select-input w-full appearance-none border border-app-border bg-app-secondary text-app-text outline-none transition-colors focus:border-app-accent focus:ring-2 focus:ring-app-accent/30 ${base} ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-app-muted ${
            compact ? "right-2 h-3.5 w-3.5" : "right-3 h-4 w-4"
          }`}
        />
      </div>
    </div>
  );
}
