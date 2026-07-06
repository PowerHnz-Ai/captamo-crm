export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { processNormalizedWebhookEvents } from "@/lib/webhook-pipeline";
import { resolveWebhookTarget } from "@/lib/webhook-resolve";
import { logWebhookEvent } from "@/lib/webhook-log";
import { getWhatsAppProvider } from "@/lib/whatsapp";

async function handleWebhook(
  request: NextRequest,
  provider: "meta" | "wasender" | "evolution"
) {
  let companyId = "";
  try {
    const payload = await request.json();
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
