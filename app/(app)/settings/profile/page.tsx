"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AvatarCropModal } from "@/components/users/AvatarCropModal";
import { UserAvatar } from "@/components/users/UserAvatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch, parseApiJson } from "@/lib/api-fetch";
import { roleLabel } from "@/lib/roles";

export default function ProfileSettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setUsername(profile.username || "");
    setJobTitle(profile.jobTitle || "");
    setPhotoUrl(profile.photoUrl);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    return () => {
      if (pendingImageUrlRef.current) {
        URL.revokeObjectURL(pendingImageUrlRef.current);
      }
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim() || null,
          jobTitle: jobTitle.trim() || null,
        }),
      });
      const data = await parseApiJson<{ user?: { photoUrl?: string }; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
      await refreshProfile();
      if (data.user?.photoUrl) setPhotoUrl(data.user.photoUrl);
      setSuccess("Perfil atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function clearPendingImage() {
    if (pendingImageUrlRef.current) {
      URL.revokeObjectURL(pendingImageUrlRef.current);
      pendingImageUrlRef.current = null;
    }
    setPendingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");

    if (!file.type.startsWith("image/")) {
      setError("Formato inválido. Use JPEG, PNG ou WebP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Imagem muito grande (máx. 2 MB).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    clearPendingImage();
    const objectUrl = URL.createObjectURL(file);
    pendingImageUrlRef.current = objectUrl;
    setPendingImageUrl(objectUrl);
  }

  async function handleCropConfirm(blob: Blob) {
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await apiFetch("/api/me/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await parseApiJson<{ photoUrl?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Erro ao enviar foto.");
      setPhotoUrl(data.photoUrl);
      await refreshProfile();
      setSuccess("Foto atualizada.");
      clearPendingImage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar foto.");
      throw err;
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell title="Meu perfil" subtitle="Nome, cargo e foto exibidos em todo o sistema">
      <div className="mx-auto max-w-xl">
        <Card className="p-6">
          {loading ? (
            <p className="text-app-subtle">Carregando...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="flex items-center gap-4">
                <UserAvatar
                  name={name || profile?.email}
                  seed={name || profile?.email}
                  photoUrl={photoUrl}
                  size="xl"
                />
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Alterar foto
                  </Button>
                  <p className="text-xs text-app-muted">JPEG, PNG ou WebP. Máx. 2 MB.</p>
                </div>
              </div>

              <Input
                label="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div>
                <Input
                  label="Nome de usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex.: Power, Ana, Suporte"
                  maxLength={40}
                />
                <p className="mt-1.5 text-xs text-app-muted">
                  Nome curto exibido ao assinar mensagens no WhatsApp. Se vazio, usa o primeiro
                  nome do nome completo.
                </p>
              </div>

              <Input
                label="Cargo"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ex.: Vendedor, Suporte, Gerente comercial"
              />

              <div className="rounded-xl border border-app-border bg-app-secondary/30 px-3 py-2 text-sm text-app-subtle">
                <p>{profile?.email}</p>
                <p className="text-app-accent">{roleLabel(profile?.effectiveRole || "member")}</p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              {success && <p className="text-sm text-emerald-400">{success}</p>}

              <Button type="submit" loading={saving}>
                Salvar perfil
              </Button>
            </form>
          )}
        </Card>
      </div>

      {pendingImageUrl && (
        <AvatarCropModal
          imageSrc={pendingImageUrl}
          onClose={clearPendingImage}
          onConfirm={handleCropConfirm}
        />
      )}
    </AppShell>
  );
}
