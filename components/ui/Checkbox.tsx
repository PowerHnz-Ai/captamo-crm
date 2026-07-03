"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";

interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  id?: string;
  name?: string;
  value?: string;
  label?: ReactNode;
  title?: string;
  className?: string;
  labelClassName?: string;
}

export function Checkbox({
  checked = false,
  onChange,
  disabled,
  indeterminate,
  id,
  name,
  value,
  label,
  title,
  className = "",
  labelClassName = "",
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id || autoId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  const control = (
    <span className={`ultra-checkbox-control ${className}`.trim()}>
      <input
        ref={inputRef}
        id={inputId}
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        title={title}
        onChange={(e) => onChange?.(e.target.checked)}
        className="ultra-checkbox-input"
      />
      <span className="ultra-checkbox-box" aria-hidden="true">
        <Check className="ultra-checkbox-icon ultra-checkbox-check" strokeWidth={3} />
        <Minus className="ultra-checkbox-icon ultra-checkbox-minus" strokeWidth={3} />
      </span>
    </span>
  );

  if (label !== undefined) {
    return (
      <label
        htmlFor={inputId}
        className={`ultra-checkbox-label ${disabled ? "is-disabled" : ""} ${labelClassName}`.trim()}
      >
        {control}
        <span className="ultra-checkbox-text">{label}</span>
      </label>
    );
  }

  return control;
}
