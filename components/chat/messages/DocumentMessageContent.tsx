"use client";

import { FileText, Download } from "lucide-react";
import { useAuthenticatedMediaSrc } from "@/hooks/useAuthenticatedMediaSrc";

interface DocumentMessageContentProps {
  src: string;
  filename?: string;
  caption?: string;
}

export function DocumentMessageContent({
  src,
  filename,
  caption,
}: DocumentMessageContentProps) {
  const { src: resolvedSrc, loading, error } = useAuthenticatedMediaSrc(src);
  const name = filename || caption || "Documento";

  if (loading) {
    return <p className="text-xs text-app-muted">Carregando documento...</p>;
  }
  if (error || !resolvedSrc) {
    return <p className="text-xs text-app-muted italic">Documento indisponível</p>;
  }

  return (
    <div className="flex min-w-[200px] items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <a
          href={resolvedSrc}
          target="_blank"
          rel="noopener noreferrer"
          download={name}
          className="mt-0.5 inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline"
        >
          <Download className="h-3 w-3" />
          Baixar
        </a>
      </div>
    </div>
  );
}
