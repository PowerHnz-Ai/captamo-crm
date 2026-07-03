"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getCroppedAvatarBlob } from "@/lib/avatar-crop";
import "react-easy-crop/react-easy-crop.css";

interface AvatarCropModalProps {
  imageSrc: string;
  onClose: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}

export function AvatarCropModal({ imageSrc, onClose, onConfirm }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewUrlRef = useRef<string | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  useEffect(() => {
    if (!croppedAreaPixels) return;

    let cancelled = false;

    getCroppedAvatarBlob(imageSrc, croppedAreaPixels, { outputSize: 128, quality: 0.85 })
      .then((blob) => {
        if (cancelled) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [imageSrc, croppedAreaPixels]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError("");
    try {
      const blob = await getCroppedAvatarBlob(imageSrc, croppedAreaPixels);
      await onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar imagem.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-app-border bg-app-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Ajustar foto</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-app-muted hover:bg-white/5 hover:text-app-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-[280px] overflow-hidden rounded-xl bg-app-secondary">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="avatar-zoom" className="mb-1.5 block text-sm font-medium text-app-subtle">
            Zoom
          </label>
          <input
            id="avatar-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-app-accent"
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-app-subtle">Pré-visualização</p>
          <div className="flex items-end gap-4">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 overflow-hidden rounded-full bg-app-secondary">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-full w-full max-w-none object-cover"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-xs text-app-muted">Menu</p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-app-secondary">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-full w-full max-w-none object-cover"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-xs text-app-muted">Perfil</p>
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!croppedAreaPixels}
            onClick={handleConfirm}
          >
            Salvar foto
          </Button>
        </div>
      </div>
    </div>
  );
}
