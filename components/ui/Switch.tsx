"use client";

import { useId, type ReactNode } from "react";

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: ReactNode;
  title?: string;
  className?: string;
  labelClassName?: string;
}

export function Switch({
  checked = false,
  onChange,
  disabled,
  id,
  label,
  title,
  className = "",
  labelClassName = "",
}: SwitchProps) {
  const autoId = useId();
  const switchId = id || autoId;

  const track = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? "border-app-accent bg-app-accent"
          : "border-app-border bg-app-secondary"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );

  if (label !== undefined) {
    return (
      <label
        htmlFor={switchId}
        className={`inline-flex cursor-pointer items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : ""} ${labelClassName}`}
      >
        {track}
        <span className="text-xs text-app-subtle">{label}</span>
      </label>
    );
  }

  return track;
}
