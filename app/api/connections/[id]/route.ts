export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  getConnection,
  deleteConnection,
  resolveConnectionConfig,
} from "@/lib/connections";
import { createWhatsAppProvider } from "@/lib/whatsapp";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const perm = requirePermission(context.auth, "connections.view");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  const { id } = await params;
  const connection = await getConnection(context.companyId, id);
  if (!connection) {
    return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ connection });
}

export async function DELETE(
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

  // Conexão oficial (meta_cloud) é da Captamo — só o admin da plataforma exclui.
  if (connection.provider === "meta_cloud") {
    const official = requirePlatformAdmin(context.auth);
    if (!official.ok) {
      return NextResponse.json({ error: official.error }, { status: official.status });
    }
  }

  if (connection.instanceId) {
    try {
      const provider = createWhatsAppProvider(
        await resolveConnectionConfig(connection)
      );
      if (provider.logout) {
        await provider.logout(connection.instanceId);
      }
    } catch {
      // Ignora falhas ao desconectar; segue removendo o registro.
    }
  }

  await deleteConnection(context.companyId, id);
  return NextResponse.json({ success: true });
}
