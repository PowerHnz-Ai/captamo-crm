import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const NATIVE_PICKER_TYPES = new Set([
  "date",
  "month",
  "time",
  "datetime-local",
]);

export function Input({ label, className = "", id, type, ...props }: InputProps) {
  const isNativePicker = type ? NATIVE_PICKER_TYPES.has(type) : false;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-app-subtle">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        className={`h-11 w-full rounded-xl border border-app-border bg-app-secondary px-3 text-[0.9375rem] text-app-text outline-none transition-colors placeholder:text-app-muted focus:border-app-accent focus:ring-2 focus:ring-app-accent/30 ${isNativePicker ? "ultra-native-picker" : ""} ${className}`}
        {...props}
      />
    </div>
  );
}
