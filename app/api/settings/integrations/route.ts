export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppConfig, updateCompanyWhatsAppConfig } from "@/lib/companies";
import { getIntegrationEnvStatus, isProductionWebhookUrl, checkWebhookUrlReachability } from "@/lib/integration-env";
import { getMessagingLimitStatus } from "@/lib/messaging-limits";
import { resolveCompanyContext } from "@/lib/request-company";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { updateIntegrationSchema } from "@/lib/validators";
import { listRecentWebhookEvents } from "@/lib/webhook-log";

export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const perm = requirePlatformAdmin(context.auth);
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const config = await getWhatsAppConfig(context.companyId);
  const limits = await getMessagingLimitStatus(context.companyId);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const envStatus = getIntegrationEnvStatus();
  const recentWebhookEvents = await listRecentWebhookEvents(context.companyId);

  const callbackUrl =
    config.provider === "wasender"
      ? `${appUrl}/api/webhook/whatsapp/wasender`
      : config.provider === "evolution"
        ? `${appUrl}/api/webhook/whatsapp/evolution`
        : `${appUrl}/api/webhook/whatsapp/meta`;

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
  const webhookReachability =
    verifyToken && isProductionWebhookUrl(appUrl)
      ? await checkWebhookUrlReachability(callbackUrl, verifyToken)
      : {
          ok: false,
          message: appUrl.includes("localhost")
            ? "APP_URL aponta para localhost — use produção ou ngrok na Meta."
            : "WHATSAPP_VERIFY_TOKEN não configurado no servidor.",
        };

  return NextResponse.json({
    config: {
      provider: config.provider,
      phoneNumberId: config.phoneNumberId,
      wabaId: config.wabaId,
      instanceId: config.instanceId,
      dailyCap: config.dailyCap,
      baseUrl: config.baseUrl,
    },
    limits,
    webhooks: {
      meta: `${appUrl}/api/webhook/whatsapp/meta`,
      wasender: `${appUrl}/api/webhook/whatsapp/wasender`,
      evolution: `${appUrl}/api/webhook/whatsapp/evolution`,
    },
    webhookSetup: {
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ? "••••••••" : null,
      verifyTokenConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
      subscribeFields: ["messages"],
      callbackUrl,
      productionUrlReady: isProductionWebhookUrl(appUrl),
      localhostWarning:
        !isProductionWebhookUrl(appUrl) ||
        appUrl.includes("localhost"),
      reachability: webhookReachability,
    },
    envStatus,
    recentWebhookEvents,
  });
}

export async function PUT(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const perm = requirePlatformAdmin(context.auth);
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const body = await request.json();
  const parsed = updateIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await updateCompanyWhatsAppConfig(context.companyId, parsed.data);
  const config = await getWhatsAppConfig(context.companyId);
  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const perm = requirePlatformAdmin(context.auth);
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const provider = await getWhatsAppProvider(context.companyId);
  if (!provider.testConnection) {
    return NextResponse.json({ ok: false, message: "Teste não disponível." });
  }

  const result = await provider.testConnection();
  return NextResponse.json(result);
}
