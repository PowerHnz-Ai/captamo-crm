"use client";

import type { MessageReaction } from "@/lib/types";

interface MessageReactionsProps {
  reactions?: MessageReaction[];
}

export function MessageReactions({ reactions }: MessageReactionsProps) {
  if (!reactions?.length) return null;

  const emojis = reactions.map((reaction) => reaction.emoji).filter(Boolean);
  if (!emojis.length) return null;

  return (
    <div className="absolute -bottom-2 right-2 flex items-center gap-0.5 rounded-full border border-app-border bg-app-card px-1.5 py-0.5 text-sm shadow-sm">
      {emojis.map((emoji, index) => (
        <span key={`${emoji}-${index}`} aria-label="Reação">
          {emoji}
        </span>
      ))}
    </div>
  );
}
