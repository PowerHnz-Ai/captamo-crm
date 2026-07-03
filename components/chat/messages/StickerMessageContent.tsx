"use client";

import { useAuthenticatedMediaSrc } from "@/hooks/useAuthenticatedMediaSrc";

interface StickerMessageContentProps {
  src: string;
}

export function StickerMessageContent({ src }: StickerMessageContentProps) {
  const { src: resolvedSrc, loading, error } = useAuthenticatedMediaSrc(src);

  if (loading) {
    return <p className="message-bubble-meta">Carregando figurinha...</p>;
  }
  if (error || !resolvedSrc) {
    return <p className="message-bubble-meta italic">Figurinha indisponível</p>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt="Figurinha"
      className="h-32 w-32 object-contain"
    />
  );
}
