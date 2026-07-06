export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import {
  canMonitorConversations,
  canReadConversationContent,
} from "@/lib/permissions";
import { getSql } from "@/lib/db";

/**
 * Contador agregado de não lidas por conexão — substitui o antigo loop que
 * recarregava a lista inteira de cada inbox a cada poll.
 */
export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (
    !canReadConversationContent(context.auth) &&
    !canMonitorConversations(context.auth)
  ) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const groups = await getSql().conversation.groupBy({
      by: ["connectionId"],
      where: { companyId: context.companyId, unreadCount: { gt: 0 } },
      _sum: { unreadCount: true },
    });

    // connectionId null = conversas da conexão default (o cliente resolve).
    const byConnection: Record<string, number> = {};
    let unassignedConnection = 0;
    let total = 0;
    for (const group of groups) {
      const count = group._sum.unreadCount || 0;
      total += count;
      if (group.connectionId) {
        byConnection[group.connectionId] = count;
      } else {
        unassignedConnection += count;
      }
    }

    return NextResponse.json({ byConnection, unassignedConnection, total });
  } catch (error) {
    console.error("[conversations/unread-counts GET]", error);
    return NextResponse.json({ error: "Erro ao contar não lidas." }, { status: 500 });
  }
}
