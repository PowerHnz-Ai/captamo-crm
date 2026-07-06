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

  if (connection.provider !== "meta_cloud" && connection.instanceId) {
    try {
      const provider = createWhatsAppProvider(
        await resolveConnectionConfig(connection)
      );
      if (provider.logout) {
        await provider.logout(connection.instanceId);
      }
    } catch (error) {
      console.error("[connections/disconnect] Falha ao desconectar no provedor:", error);
    }
  }

  await updateConnection(context.companyId, id, { status: "disconnected" });
  const updated = await getConnection(context.companyId, id);

  return NextResponse.json({ connection: updated });
}
