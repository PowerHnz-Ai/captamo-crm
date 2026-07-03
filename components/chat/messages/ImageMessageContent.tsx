"use client";

import { useState } from "react";
import { useAuthenticatedMediaSrc } from "@/hooks/useAuthenticatedMediaSrc";

interface ImageMessageContentProps {
  src: string;
  alt?: string;
  caption?: string;
  className?: string;
}

export function ImageMessageContent({ src, alt, caption, className }: ImageMessageContentProps) {
  const [open, setOpen] = useState(false);
  const { src: resolvedSrc, loading, error } = useAuthenticatedMediaSrc(src);

  if (loading) {
    return <p className="text-xs text-app-muted">Carregando imagem...</p>;
  }
  if (error || !resolvedSrc) {
    return <p className="text-xs text-app-muted italic">Imagem indisponível</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block max-w-full overflow-hidden ${className || "rounded-lg"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedSrc}
          alt={alt || "Imagem"}
          className="max-h-72 max-w-full object-cover"
        />
      </button>
      {caption && caption !== "[imagem]" && (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{caption}</p>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedSrc}
            alt={alt || "Imagem"}
            className="max-h-[90vh] max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
