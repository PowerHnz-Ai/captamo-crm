export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { verifyAuthTokenWithReason } from "@/lib/auth-server";
import { subscribeRealtime } from "@/lib/realtime";

const PING_INTERVAL_MS = 25_000;
// ID token do Firebase expira em 1h: encerra antes para forçar reconexão
// com token novo (EventSource não renova headers).
const MAX_STREAM_LIFETIME_MS = 55 * 60_000;

/**
 * Stream SSE de eventos do inbox. EventSource não envia headers, então o
 * token Firebase vem por query param e passa pelo mesmo pipeline de auth
 * das demais rotas.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const { auth } = await verifyAuthTokenWithReason(token ? `Bearer ${token}` : null);
  if (!auth) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  // Impersonação (platform admin atuando como clínica): canal da clínica.
  const impersonate = request.nextUrl.searchParams.get("impersonate")?.trim();
  const companyId =
    impersonate && auth.platformAdmin ? impersonate : auth.companyId;
  if (!companyId) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      let ping: ReturnType<typeof setInterval> | undefined;
      let maxLife: ReturnType<typeof setTimeout> | undefined;

      const cleanup = (close: boolean) => {
        if (closed) return;
        closed = true;
        if (ping) clearInterval(ping);
        if (maxLife) clearTimeout(maxLife);
        unsubscribe();
        if (close) {
          try {
            controller.close();
          } catch {
            // stream já encerrado pelo cliente
          }
        }
      };

      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup(false);
        }
      };

      send(`retry: 5000\n\n: connected\n\n`);
      unsubscribe = subscribeRealtime(companyId, (event) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });
      ping = setInterval(() => send(`: ping\n\n`), PING_INTERVAL_MS);
      maxLife = setTimeout(() => cleanup(true), MAX_STREAM_LIFETIME_MS);
      request.signal.addEventListener("abort", () => cleanup(false));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Desliga o buffering do Nginx mesmo sem location dedicado.
      "X-Accel-Buffering": "no",
    },
  });
}
