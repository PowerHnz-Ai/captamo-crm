"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { contactAvatarColors, contactInitials } from "@/lib/chat-utils";

interface UserAvatarProps {
  name?: string;
  seed?: string;
  photoUrl?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  title?: string;
}

const sizeClasses = {
  xs: "h-5 w-5 text-[0.5625rem]",
  sm: "h-8 w-8 text-[0.6875rem]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-24 w-24 text-base",
};

function needsAuthenticatedFetch(photoUrl: string): boolean {
  return photoUrl.startsWith("/api/");
}

export function UserAvatar({
  name,
  seed,
  photoUrl,
  size = "sm",
  className = "",
  title,
}: UserAvatarProps) {
  const avatarSeed = seed || name || "?";
  const avatar = contactAvatarColors(avatarSeed);
  const initials = contactInitials(name, avatarSeed);
  const sizeClass = sizeClasses[size];

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
    setResolvedSrc(null);

    if (!photoUrl) return;

    if (!needsAuthenticatedFetch(photoUrl)) {
      setResolvedSrc(photoUrl);
      return;
    }

    let cancelled = false;
    let blobUrl: string | null = null;

    apiFetch(photoUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`avatar ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setResolvedSrc(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setPhotoFailed(true);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [photoUrl]);

  if (resolvedSrc && !photoFailed) {
    return (
      <span
        title={title || name}
        className={`relative inline-flex shrink-0 overflow-hidden rounded-full ${sizeClass} ${className}`}
      >
        <img
          src={resolvedSrc}
          alt=""
          className="h-full w-full max-w-none object-cover"
          onError={() => setPhotoFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      title={title || name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${sizeClass} ${className}`}
      style={{ background: avatar.background, color: avatar.color }}
    >
      {initials}
    </span>
  );
}
