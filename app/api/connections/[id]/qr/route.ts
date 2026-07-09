export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import {
  getConnection,
  updateConnection,
  resolveConnectionConfig,
} from "@/lib/connections";
import { createWhatsAppProvider } from "@/lib/whatsapp";
import type { WhatsAppProvider } from "@/lib/whatsapp/types";

async function applyEvolutionWebhook(
  provider: WhatsAppProvider,
  instanceId: string
): Promise<{ webhookConfigured: boolean; webhookWarning?: string }> {
  if (!provider.ensureWebhook) {
    return { webhookConfigured: true };
  }
  try {
    await provider.ensureWebhook(instanceId);
    return { webhookConfigured: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha ao configurar webhook na Evolution.";
    console.error(
      `[connections/qr] Falha ao configurar webhook Evolution (${instanceId}):`,
      error
    );
    return { webhookConfigured: false, webhookWarning: message };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const perm = requirePermission(context.auth, "connections.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const { id } = await params;
  const connection = await getConnection(context.companyId, id);
  if (!connection) {
    return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  }
  if (!connection.instanceId) {
    return NextResponse.json(
      { error: "Conexão sem instância para QR." },
      { status: 400 }
    );
  }

  try {
    const provider = createWhatsAppProvider(
      await resolveConnectionConfig(connection)
    );
    if (!provider.getConnectionState || !provider.getQrCode) {
      return NextResponse.json(
        { error: "Provedor não suporta QR." },
        { status: 400 }
      );
    }

    if (connection.instanceId) {
      await applyEvolutionWebhook(provider, connection.instanceId);
    }

    const state = await provider.getConnectionState(connection.instanceId);

    if (state === "open") {
      const webhook = connection.instanceId
        ? await applyEvolutionWebhook(provider, connection.instanceId)
        : { webhookConfigured: true };

      if (connection.status !== "connected") {
        await updateConnection(context.companyId, id, { status: "connected" });
      }
      return NextResponse.json({
        state,
        connected: true,
        webhookConfigured: webhook.webhookConfigured,
        ...(webhook.webhookWarning ? { webhookWarning: webhook.webhookWarning } : {}),
      });
    }

    const qr = await provider.getQrCode(connection.instanceId);
    if (connection.status !== "connecting") {
      await updateConnection(context.companyId, id, { status: "connecting" });
    }

    return NextResponse.json({
      state: qr.state,
      connected: false,
      base64: qr.base64,
      code: qr.code,
      pairingCode: qr.pairingCode,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao obter QR code.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
