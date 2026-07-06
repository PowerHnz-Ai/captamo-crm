export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import {
  getConnection,
  resolveConnectionConfig,
} from "@/lib/connections";
import { createWhatsAppProvider } from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const perm = requirePermission(context.auth, "integrations.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const { id } = await params;
  const connection = await getConnection(context.companyId, id);
  if (!connection) {
    return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  }
  if (connection.provider === "meta_cloud") {
    return NextResponse.json(
      { error: "Meta Cloud não usa webhook Evolution." },
      { status: 400 }
    );
  }
  if (!connection.instanceId) {
    return NextResponse.json(
      { error: "Conexão sem instância." },
      { status: 400 }
    );
  }

  try {
    const provider = createWhatsAppProvider(
      await resolveConnectionConfig(connection)
    );
    if (!provider.ensureWebhook) {
      return NextResponse.json(
        { error: "Provedor não suporta webhook." },
        { status: 400 }
      );
    }

    const result = await provider.ensureWebhook(connection.instanceId);
    return NextResponse.json({
      webhookConfigured: true,
      url: result.url,
      instanceId: connection.instanceId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao configurar webhook.";
    console.error(
      `[connections/webhook] Falha (${connection.instanceId}):`,
      error
    );
    return NextResponse.json(
      {
        webhookConfigured: false,
        error: message,
        instanceId: connection.instanceId,
      },
      { status: 502 }
    );
  }
}
