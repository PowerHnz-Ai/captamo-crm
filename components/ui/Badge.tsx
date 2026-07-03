import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
  title?: string;
}

const tones = {
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  neutral: "bg-white/5 text-app-subtle border-app-border",
};

export function Badge({ children, tone = "neutral", title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
