"use client";

import { useAuthenticatedMediaSrc } from "@/hooks/useAuthenticatedMediaSrc";

interface VideoMessageContentProps {
  src: string;
  caption?: string;
}

export function VideoMessageContent({ src, caption }: VideoMessageContentProps) {
  const { src: resolvedSrc, loading, error } = useAuthenticatedMediaSrc(src);

  if (loading) {
    return <p className="message-bubble-meta">Carregando vídeo...</p>;
  }
  if (error || !resolvedSrc) {
    return <p className="message-bubble-meta italic">Vídeo indisponível</p>;
  }

  return (
    <div className="max-w-full">
      <video
        src={resolvedSrc}
        controls
        playsInline
        preload="metadata"
        className="max-h-72 max-w-full rounded-lg"
      />
      {caption && caption !== "[vídeo]" && (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{caption}</p>
      )}
    </div>
  );
}
