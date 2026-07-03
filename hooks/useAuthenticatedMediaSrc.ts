"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

export function useAuthenticatedMediaSrc(url: string | null): {
  src: string | null;
  loading: boolean;
  error: boolean;
} {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setLoading(false);
      setError(false);
      return;
    }

    if (url.startsWith("blob:") || /^https?:\/\//i.test(url)) {
      setSrc(url);
      setLoading(false);
      setError(false);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;
    setLoading(true);
    setError(false);

    apiFetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("media fetch failed");
        const contentType = res.headers.get("content-type")?.split(";")[0]?.trim();
        const blob = await res.blob();
        if (!active) return;
        const typedBlob =
          contentType && (!blob.type || blob.type === "application/octet-stream")
            ? blob.slice(0, blob.size, contentType)
            : blob;
        objectUrl = URL.createObjectURL(typedBlob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { src, loading, error };
}
