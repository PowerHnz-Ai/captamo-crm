type UltraWordmarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "hub";
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
}: UltraWordmarkProps) {
  return (
    <span
      className={`font-ultra-logo tracking-tight text-app-text ${sizeClasses[size]} ${className}`}
    >
      captamo
    </span>
  );
}
