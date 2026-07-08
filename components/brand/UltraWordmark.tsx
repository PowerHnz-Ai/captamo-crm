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

/** Degradê da marca captamo (igual ao site e ao Captamo Tasks): azul → cinza → dourado. */
const gradientStyle: React.CSSProperties = {
  backgroundImage: "linear-gradient(90deg, #2e9ee5 0%, #8fa9a0 52%, #d9c07e 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export function UltraWordmark({
  className = "",
  size = "md",
}: UltraWordmarkProps) {
  return (
    <span
      style={gradientStyle}
      className={`font-ultra-logo tracking-tight ${sizeClasses[size]} ${className}`}
    >
      captamo
    </span>
  );
}
