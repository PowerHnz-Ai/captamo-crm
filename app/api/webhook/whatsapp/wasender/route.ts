export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { processNormalizedWebhookEvents } from "@/lib/webhook-pipeline";
import { resolveWebhookTarget } from "@/lib/webhook-resolve";
import { logWebhookEvent } from "@/lib/webhook-log";
import { getWhatsAppProvider } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  let companyId = "";
  try {
    const payload = await request.json();
    const target = await resolveWebhookTarget("wasender", payload);
    if (!target) {
      return NextResponse.json({ success: true, ignored: true });
    }
    companyId = target.companyId;
    const provider = await getWhatsAppProvider(companyId, target.connectionId);
    const events = provider.parseWebhook(payload, request.headers);

    await logWebhookEvent({
      companyId,
      provider: "wasender",
      eventType: "batch",
      status: "received",
      eventCount: events.length,
    });

    await processNormalizedWebhookEvents(
      events,
      { companyId },
      { provider: "wasender", connectionId: target.connectionId }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[webhook/wasender] Erro:", error);
    if (companyId) {
      await logWebhookEvent({
        companyId,
        provider: "wasender",
        eventType: "batch",
        status: "error",
        error: message,
      });
    }
    return NextResponse.json({ success: true });
  }
}
