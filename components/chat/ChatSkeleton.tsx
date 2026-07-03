"use client";

export function ChatSkeleton() {
  return (
    <div className="space-y-3 px-1" aria-hidden>
      <div className="flex justify-start">
        <div className="h-10 w-48 animate-pulse rounded-2xl rounded-tl-sm bg-white/10" />
      </div>
      <div className="flex justify-end">
        <div className="h-14 w-56 animate-pulse rounded-2xl rounded-tr-sm bg-app-accent/20" />
      </div>
      <div className="flex justify-start">
        <div className="h-16 w-64 animate-pulse rounded-2xl rounded-tl-sm bg-white/10" />
      </div>
      <div className="flex justify-end">
        <div className="h-8 w-36 animate-pulse rounded-2xl rounded-tr-sm bg-app-accent/20" />
      </div>
      <div className="flex justify-start">
        <div className="h-12 w-40 animate-pulse rounded-2xl rounded-tl-sm bg-white/10" />
      </div>
    </div>
  );
}
