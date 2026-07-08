export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processNormalizedWebhookEvents } from "@/lib/webhook-pipeline";
import { resolveWebhookTarget } from "@/lib/webhook-resolve";
import { logWebhookEvent } from "@/lib/webhook-log";
import { getWhatsAppProvider } from "@/lib/whatsapp";

/**
 * Valida a assinatura X-Hub-Signature-256 da Meta (HMAC-SHA256 do corpo cru com
 * META_APP_SECRET). Opt-in: se META_APP_SECRET não estiver configurado, não
 * valida — mantém compatibilidade até o segredo ser preenchido. Depois de setar,
 * requisições forjadas (sem a assinatura correta) passam a ser rejeitadas.
 */
function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expectedHex = signatureHeader.slice("sha256=".length);
  const computedHex = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(computedHex, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function handleWebhook(
  request: NextRequest,
  provider: "meta" | "wasender" | "evolution"
) {
  let companyId = "";
  try {
    const rawBody = await request.text();

    if (
      provider === "meta" &&
      !verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))
    ) {
      console.warn("[webhook/meta] assinatura X-Hub-Signature-256 inválida — ignorado");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const target = await resolveWebhookTarget(provider, payload);
    if (!target) {
      // Número não pertence a nenhuma empresa: 200 para a Meta não reenviar.
      return NextResponse.json({ success: true, ignored: true });
    }
    companyId = target.companyId;
    const whatsappProvider = await getWhatsAppProvider(
      companyId,
      target.connectionId
    );
    const events = whatsappProvider.parseWebhook(payload, request.headers);

    await logWebhookEvent({
      companyId,
      provider,
      eventType: "batch",
      status: "received",
      eventCount: events.length,
    });

    await processNormalizedWebhookEvents(
      events,
      { companyId },
      { provider, connectionId: target.connectionId }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[webhook/${provider}] Erro ao receber:`, error);
    if (companyId) {
      await logWebhookEvent({
        companyId,
        provider,
        eventType: "batch",
        status: "error",
        error: message,
      });
    }
    return NextResponse.json({ success: true });
  }
}

export async function POST(request: NextRequest) {
  return handleWebhook(request, "meta");
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
