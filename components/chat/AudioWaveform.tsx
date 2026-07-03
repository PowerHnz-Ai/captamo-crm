"use client";

interface AudioWaveformProps {
  levels: number[];
  active?: boolean;
  className?: string;
}

export function AudioWaveform({ levels, active = true, className = "" }: AudioWaveformProps) {
  return (
    <div
      className={`flex h-8 w-full min-w-0 items-center gap-[2px] overflow-hidden ${className}`}
      aria-hidden
    >
      {levels.map((level, index) => {
        const height = 4 + Math.round(level * 22);
        return (
          <span
            key={index}
            className={`min-w-0 flex-1 rounded-full transition-[height] duration-75 ${
              active ? "bg-emerald-400/90" : "bg-white/25"
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}
