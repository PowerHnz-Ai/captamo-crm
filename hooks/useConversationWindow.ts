"use client";

import { useEffect, useState } from "react";
import {
  conversationWindowRemainingMs,
  formatWindowRemaining,
} from "@/lib/conversation-window";

/**
 * Cronômetro da janela de 24h: recalcula o tempo restante a cada 30s.
 * `label` pronto para exibir: "23h 05min" / "42min"; null quando fechada
 * ou sem mensagem recebida.
 */
export function useConversationWindow(lastInboundAt: unknown): {
  open: boolean;
  label: string | null;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const remaining = conversationWindowRemainingMs(
    lastInboundAt as Parameters<typeof conversationWindowRemainingMs>[0],
    now
  );
  const open = remaining != null && remaining > 0;
  return { open, label: open ? formatWindowRemaining(remaining) : null };
}
