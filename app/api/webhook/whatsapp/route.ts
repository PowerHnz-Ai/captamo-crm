export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { processNormalizedWebhookEvents } from "@/lib/webhook-pipeline";
import { resolveWebhookTarget } from "@/lib/webhook-resolve";
import { logWebhookEvent } from "@/lib/webhook-log";
import { getWhatsAppProvider } from "@/lib/whatsapp";

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

export async function POST(request: NextRequest) {
  let companyId = "";
  try {
    const payload = await request.json();
    const target = await resolveWebhookTarget("meta", payload);
    companyId = target.companyId;
    const provider = await getWhatsAppProvider(companyId, target.connectionId);
    const events = provider.parseWebhook(payload, request.headers);

    await logWebhookEvent({
      companyId,
      provider: "meta",
      eventType: "batch",
      status: "received",
      eventCount: events.length,
    });

    await processNormalizedWebhookEvents(
      events,
      { companyId },
      { provider: "meta", connectionId: target.connectionId }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[webhook] Erro:", error);
    if (companyId) {
      await logWebhookEvent({
        companyId,
        provider: "meta",
        eventType: "batch",
        status: "error",
        error: message,
      });
    }
    return NextResponse.json({ success: true });
  }
}
