"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import type { MediaAsset, MediaAssetSource } from "@/lib/types";

export interface MediaLibrarySelection {
  assetId: string;
  storagePath: string;
  previewUrl?: string;
  name?: string;
}

interface MediaLibraryPickerProps {
  source?: MediaAssetSource;
  value?: MediaLibrarySelection | null;
  onChange: (selection: MediaLibrarySelection | null) => void;
  disabled?: boolean;
}

type Tab = "library" | "upload";

export function MediaLibraryPicker({
  source = "campaign",
  value,
  onChange,
  disabled,
}: MediaLibraryPickerProps) {
  const [tab, setTab] = useState<Tab>("library");
  const [assets, setAssets] = useState<
    Array<MediaAsset & { previewUrl?: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/media-library");
      const data = await parseApiJson<{
        assets?: Array<MediaAsset & { previewUrl?: string }>;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao carregar biblioteca.");
      setAssets(data.assets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "library") void loadAssets();
  }, [tab, loadAssets]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", source);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));

      const res = await apiFetch("/api/media-library", {
        method: "POST",
        body: formData,
      });
      const data = await parseApiJson<{
        asset?: MediaAsset;
        previewUrl?: string;
        error?: string;
      }>(res);
      if (!res.ok || !data.asset) {
        throw new Error(data.error || "Erro ao enviar imagem.");
      }

      onChange({
        assetId: data.asset.id,
        storagePath: data.asset.storagePath,
        previewUrl: data.previewUrl,
        name: data.asset.name,
      });
      setAssets((prev) => [
        { ...data.asset!, previewUrl: data.previewUrl },
        ...prev,
      ]);
      setTab("library");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setUploading(false);
    }
  }

  function selectAsset(asset: MediaAsset & { previewUrl?: string }) {
    onChange({
      assetId: asset.id,
      storagePath: asset.storagePath,
      previewUrl: asset.previewUrl,
      name: asset.name,
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-app-border p-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setTab("library")}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            tab === "library"
              ? "bg-app-accent text-white"
              : "bg-app-secondary/50 text-app-subtle"
          }`}
        >
          Biblioteca
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setTab("upload")}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            tab === "upload"
              ? "bg-app-accent text-white"
              : "bg-app-secondary/50 text-app-subtle"
          }`}
        >
          Enviar nova
        </button>
      </div>

      {value?.previewUrl && (
        <div className="flex items-center gap-3 rounded-lg bg-app-secondary/30 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.previewUrl}
            alt={value.name || "Imagem selecionada"}
            className="h-16 w-16 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name || "Imagem"}</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="text-xs text-red-400 hover:underline"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      {tab === "library" && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-app-subtle">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : assets.length === 0 ? (
            <p className="py-4 text-center text-sm text-app-subtle">
              Nenhuma imagem na biblioteca. Envie uma nova.
            </p>
          ) : (
            <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectAsset(asset)}
                  className={`overflow-hidden rounded-lg border-2 transition ${
                    value?.assetId === asset.id
                      ? "border-app-accent"
                      : "border-transparent hover:border-app-border"
                  }`}
                  title={asset.name}
                >
                  {asset.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.previewUrl}
                      alt={asset.name}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-app-secondary/50 text-xs text-app-subtle">
                      {asset.name.slice(0, 8)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div className="flex flex-col items-center gap-3 py-4">
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
                Escolher imagem (JPEG, PNG, WebP — máx. 5MB)
              </>
            )}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
