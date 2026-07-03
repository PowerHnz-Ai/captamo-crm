export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { incrementDailyStats } from "@/lib/stats-daily";
import { WhatsAppProviderError, extractMessageId } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { checklistConfirmSchema } from "@/lib/validators";

const RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 30;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip);

  if (!entry || now > entry.resetAt) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit excedido." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = checklistConfirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { apiKey, companyId, patientName, phone, date, time, taskId } = parsed.data;
    const scope = { companyId };

    if (apiKey !== process.env.CHECKLIST_INTEGRATION_API_KEY) {
      return NextResponse.json({ error: "API key inválida." }, { status: 401 });
    }

    const normalizedPhone = normalizePhone(phone);

    const {
      findContactByPhone,
      createOrGetContactByPhone,
      createOrGetConversationByPhone,
      saveOutboundMessage,
      saveIntegrationEvent,
    } = await import("@/lib/firestore-repositories");

    const existing = await findContactByPhone(normalizedPhone, scope);

    if (existing?.blocked) {
      await saveIntegrationEvent("task-checklist", { ...parsed.data, taskId }, "failed", scope);
      return NextResponse.json(
        { error: "Contato bloqueado." },
        { status: 403 }
      );
    }

    const metaResponse = await (async () => {
      const provider = await getWhatsAppProvider(companyId);
      return provider.sendTemplate({
        to: normalizedPhone,
        templateName: "confirmacao_agendamento",
        language: "pt_BR",
        parameters: [patientName, date, time],
      });
    })();

    const contact = await createOrGetContactByPhone(normalizedPhone, scope, {
      name: patientName,
      source: "task-checklist",
      tags: taskId ? [`task:${taskId}`] : [],
    });

    const conversation = await createOrGetConversationByPhone(normalizedPhone, contact.id, scope);
    const wamid = metaResponse.messageId || extractMessageId(metaResponse.raw);

    await saveOutboundMessage({
      contactId: contact.id,
      conversationId: conversation.id,
      whatsappMessageId: wamid,
      type: "template",
      body: `Confirmação de agendamento — ${patientName}, ${date}, ${time}`,
      status: "accepted",
      rawPayload: { metaResponse, taskId },
    });

    await incrementDailyStats(companyId, { templatesSent: 1, messagesSent: 1 });

    await saveIntegrationEvent("task-checklist", { ...parsed.data, taskId }, "success", scope);

    return NextResponse.json({
      success: true,
      contactId: contact.id,
      conversationId: conversation.id,
      companyId,
      metaResponse,
    });
  } catch (error) {
    const { saveIntegrationEvent } = await import("@/lib/firestore-repositories");
    const fallbackCompanyId = process.env.CRM_DEFAULT_COMPANY_ID || "unknown";

    await saveIntegrationEvent(
      "task-checklist",
      { error: String(error) },
      "failed",
      { companyId: fallbackCompanyId }
    ).catch(() => {});

    if (error instanceof WhatsAppProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[checklist-confirm]", error);
    return NextResponse.json({ error: "Erro interno na integração." }, { status: 500 });
  }
}
