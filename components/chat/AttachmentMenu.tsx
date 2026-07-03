"use client";

import { useRef, useState } from "react";
import { Image, FileText, Paperclip, X } from "lucide-react";

interface AttachmentMenuProps {
  disabled?: boolean;
  onPickImage: (file: File) => void;
  onPickDocument: (file: File) => void;
}

export function AttachmentMenu({
  disabled,
  onPickImage,
  onPickDocument,
}: AttachmentMenuProps) {
  const [open, setOpen] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  function pickImage(file: File) {
    setOpen(false);
    onPickImage(file);
  }

  function pickDocument(file: File) {
    setOpen(false);
    onPickDocument(file);
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-app-subtle hover:bg-white/5 hover:text-app-text disabled:opacity-40"
        aria-label="Anexar"
      >
        {open ? <X className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
      </button>

      <input
        ref={imageRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) pickImage(file);
          e.target.value = "";
        }}
      />
      <input
        ref={docRef}
        type="file"
        accept="application/pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) pickDocument(file);
          e.target.value = "";
        }}
      />

      {open && (
        <div className="absolute bottom-12 left-0 z-20 min-w-[160px] rounded-xl border border-app-border bg-app-secondary p-1 shadow-lg">
          <button
            type="button"
            disabled={disabled}
            onClick={() => imageRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
          >
            <Image className="h-4 w-4" />
            Imagem
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => docRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
          >
            <FileText className="h-4 w-4" />
            Documento
          </button>
        </div>
      )}
    </div>
  );
}
