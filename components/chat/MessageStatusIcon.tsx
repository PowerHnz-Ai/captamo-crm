"use client";

import { Check, CheckCheck, Clock } from "lucide-react";
import type { MessageStatus } from "@/lib/types";

interface MessageStatusIconProps {
  status: MessageStatus;
  outbound?: boolean;
}

export function MessageStatusIcon({ status, outbound }: MessageStatusIconProps) {
  if (!outbound) return null;

  if (status === "read") {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-400" aria-label="Lida" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="h-3.5 w-3.5 text-app-muted" aria-label="Entregue" />;
  }
  if (status === "sent" || status === "accepted") {
    return <Check className="h-3.5 w-3.5 text-app-muted" aria-label="Enviada" />;
  }
  if (status === "failed") {
    return <span className="text-[0.625rem] text-red-400">!</span>;
  }
  return <Clock className="h-3 w-3 text-app-muted" aria-label="Enviando" />;
}
