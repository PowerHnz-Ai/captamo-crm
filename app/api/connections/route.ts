export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { createConnectionSchema } from "@/lib/validators";
import {
  createConnection,
  listConnections,
  updateConnection,
  resolveConnectionConfig,
} from "@/lib/connections";
import { createWhatsAppProvider } from "@/lib/whatsapp";
import { isEvolutionInstanceAlreadyExistsError } from "@/lib/whatsapp/evolution-provider";

export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const canViewIntegrations = requirePermission(context.auth, "integrations.view");
  const canReply = requirePermission(context.auth, "conversations.reply");
  if (!canViewIntegrations.ok && !canReply.ok) {
    return NextResponse.json(
      { error: canViewIntegrations.error || canReply.error },
      { status: canViewIntegrations.status || canReply.status }
    );
  }

  const connections = await listConnections(context.companyId);
  return NextResponse.json({ connections });
}

export async function POST(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const perm = requirePermission(context.auth, "integrations.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const body = await request.json();
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { label, provider, baseUrl, phoneNumberId, wabaId } = parsed.data;
  const generatedInstanceId =
    parsed.data.instanceId ||
    `ultra_${context.companyId.slice(0, 6)}_${crypto.randomUUID().slice(0, 8)}`;

  const isUnofficial = provider === "evolution";

  if (isUnofficial && !process.env.APP_URL?.trim()) {
    return NextResponse.json(
      {
        error:
          "APP_URL não configurado no servidor. Necessário para webhook da Evolution.",
      },
      { status: 500 }
    );
  }

  let connection = await createConnection(context.companyId, {
    label,
    provider,
    baseUrl,
    phoneNumberId,
    wabaId,
    instanceId: isUnofficial ? generatedInstanceId : undefined,
    status: isUnofficial ? "connecting" : "connected",
  });

  if (isUnofficial) {
    try {
      const innerProvider = createWhatsAppProvider(
        await resolveConnectionConfig(connection)
      );
      if (innerProvider.createInstance && connection.instanceId) {
        try {
          const result = await innerProvider.createInstance(connection.instanceId);
          if (result.instanceId && result.instanceId !== connection.instanceId) {
            await updateConnection(context.companyId, connection.id, {
              instanceId: result.instanceId,
            });
            connection = { ...connection, instanceId: result.instanceId };
          }
        } catch (createError) {
          if (!isEvolutionInstanceAlreadyExistsError(createError)) {
            throw createError;
          }
        }
        if (innerProvider.ensureWebhook && connection.instanceId) {
          await innerProvider.ensureWebhook(connection.instanceId);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao criar instância.";
      return NextResponse.json(
        { error: message, connection },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ connection });
}
