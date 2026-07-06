import { EventEmitter } from "node:events";

/**
 * Barramento de eventos in-process para o inbox em tempo real (SSE).
 *
 * Funciona porque a produção roda em PM2 fork com 1 instância — todos os
 * streams SSE vivem no mesmo processo que grava as mensagens. Se um dia o
 * app escalar para múltiplas instâncias, isto precisa virar um broker
 * externo (ex.: Redis pub/sub).
 */
export type RealtimeEvent =
  | {
      type: "message:new";
      conversationId: string;
      direction: "inbound" | "outbound";
    }
  | { type: "message:status"; conversationId: string }
  | { type: "conversation:updated"; conversationId: string };

// Singleton em globalThis: sobrevive ao HMR do next dev (mesmo padrão de lib/db).
const globalForRealtime = globalThis as unknown as {
  ultrahubRealtimeEmitter?: EventEmitter;
};

function getEmitter(): EventEmitter {
  if (!globalForRealtime.ultrahubRealtimeEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalForRealtime.ultrahubRealtimeEmitter = emitter;
  }
  return globalForRealtime.ultrahubRealtimeEmitter;
}

/** Publica um evento para todos os streams da empresa. Nunca lança. */
export function publishRealtime(companyId: string, event: RealtimeEvent): void {
  try {
    getEmitter().emit(companyId, event);
  } catch (error) {
    console.warn("[realtime] falha ao publicar evento:", error);
  }
}

/** Assina eventos da empresa; retorna a função de unsubscribe. */
export function subscribeRealtime(
  companyId: string,
  listener: (event: RealtimeEvent) => void
): () => void {
  const emitter = getEmitter();
  emitter.on(companyId, listener);
  return () => {
    emitter.off(companyId, listener);
  };
}
