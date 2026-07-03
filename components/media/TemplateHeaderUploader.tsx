"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";

interface TemplateHeaderUploaderProps {
  value: {
    storagePath?: string;
    mediaAssetId?: string;
    previewUrl?: string;
    name?: string;
  } | null;
  onChange: (value: {
    storagePath: string;
    mediaAssetId: string;
    previewUrl?: string;
    name?: string;
  } | null) => void;
  disabled?: boolean;
}

export function TemplateHeaderUploader({
  value,
  onChange,
  disabled,
}: TemplateHeaderUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", "template");
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));

      const res = await apiFetch("/api/media-library", {
        method: "POST",
        body: formData,
      });
      const data = await parseApiJson<{
        asset?: { id: string; storagePath: string; name: string };
        previewUrl?: string;
        error?: string;
      }>(res);
      if (!res.ok || !data.asset) {
        throw new Error(data.error || "Erro ao enviar imagem.");
      }

      onChange({
        storagePath: data.asset.storagePath,
        mediaAssetId: data.asset.id,
        previewUrl: data.previewUrl,
        name: data.asset.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {value?.previewUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.previewUrl}
            alt={value.name || "Preview"}
            className="max-h-40 rounded-xl border border-app-border object-contain"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow"
            aria-label="Remover imagem"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <ImagePlus className="mr-2 h-4 w-4" />
                Enviar imagem
              </>
            )}
          </Button>
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
