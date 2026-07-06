"use client";

import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/lib/auth-token";
import { getImpersonation } from "@/lib/impersonation";
import type { RealtimeEvent } from "@/lib/realtime";

const BACKOFF_STEPS_MS = [2_000, 5_000, 10_000, 30_000];

interface UseRealtimeInboxOptions {
  enabled: boolean;
  onEvent: (event: RealtimeEvent) => void;
}

/**
 * Conexão SSE com /api/realtime/stream. Reconecta manualmente (com token
 * Firebase fresco) em erro/expiração — o auto-retry nativo do EventSource
 * reusaria o token velho da URL.
 */
export function useRealtimeInbox({ enabled, onEvent }: UseRealtimeInboxOptions): {
  connected: boolean;
} {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    async function connect() {
      if (cancelled) return;
      const token = await getAuthToken(attempt > 0);
      if (cancelled) return;
      if (!token) {
        scheduleReconnect();
        return;
      }

      // Impersonação lida fresca a cada (re)conexão — o canal segue a clínica.
      const impersonation = getImpersonation();
      const impersonateParam = impersonation
        ? `&impersonate=${encodeURIComponent(impersonation.companyId)}`
        : "";
      source = new EventSource(
        `/api/realtime/stream?token=${encodeURIComponent(token)}${impersonateParam}`
      );
      source.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      source.onmessage = (e) => {
        try {
          onEventRef.current(JSON.parse(e.data) as RealtimeEvent);
        } catch {
          // evento malformado — ignora
        }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (cancelled || reconnectTimer) return;
      const delay = BACKOFF_STEPS_MS[Math.min(attempt, BACKOFF_STEPS_MS.length - 1)];
      attempt++;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        void connect();
      }, delay);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible" && !source && !reconnectTimer) {
        attempt = 0;
        void connect();
      }
    }

    void connect();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      setConnected(false);
    };
  }, [enabled]);

  return { connected };
}
