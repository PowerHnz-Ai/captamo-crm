type UltraWordmarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "hub" | "operacional";
};

const sizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-4xl",
};

export function UltraWordmark({
  className = "",
  size = "md",
  variant = "default",
}: UltraWordmarkProps) {
  const label =
    variant === "operacional" ? "operacional" : "captamo";

  return (
    <span
      className={`font-ultra-logo tracking-tight text-app-text ${sizeClasses[size]} ${className}`}
    >
      {label}
    </span>
  );
}
