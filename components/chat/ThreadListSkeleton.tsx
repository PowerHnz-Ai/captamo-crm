"use client";

export function ThreadListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1 px-1.5 py-1.5" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-xl px-2.5 py-2.5"
        >
          <div className="h-12 w-12 shrink-0 rounded-full bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-2">
              <div className="h-3.5 w-2/5 rounded bg-white/10" />
              <div className="h-3 w-10 rounded bg-white/5" />
            </div>
            <div className="h-3 w-4/5 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
