import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "whatsapp" | "ghost";
  loading?: boolean;
}

const variants = {
  primary:
    "bg-app-accent text-white hover:bg-app-accent-hover shadow-md hover:shadow-lg",
  secondary:
    "bg-app-secondary text-app-subtle border border-app-border hover:text-app-text hover:border-app-accent/40",
  danger: "bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25",
  whatsapp:
    "bg-app-whatsapp/20 text-emerald-100 border border-app-whatsapp/40 hover:bg-app-whatsapp/30",
  ghost:
    "bg-transparent text-app-subtle border border-transparent hover:bg-app-secondary hover:text-app-text",
};

export function Button({
  children,
  variant = "primary",
  loading,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-[0.9375rem] font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Enviando..." : children}
    </button>
  );
}
