export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import {
  canMonitorConversations,
  canReadConversationContent,
} from "@/lib/permissions";
import { getEffectiveRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const auth = context.auth;
  const canRead = canReadConversationContent(auth);
  const canMonitor = canMonitorConversations(auth);

  if (!canRead && !canMonitor) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
    const tag = request.nextUrl.searchParams.get("tag") || undefined;
    const search = request.nextUrl.searchParams.get("search") || undefined;
    const windowParam = request.nextUrl.searchParams.get("window") || undefined;
    const periodParam = request.nextUrl.searchParams.get("period") || undefined;
    const noResponseOnly =
      request.nextUrl.searchParams.get("noResponse") === "true";
    const connectionId =
      request.nextUrl.searchParams.get("connectionId") || undefined;
    const label = request.nextUrl.searchParams.get("label") || undefined;
    let assignedTo = request.nextUrl.searchParams.get("assignedTo") || undefined;

    // Membros só veem conversas atribuídas a si, exceto quando filtram
    // explicitamente por não atribuídas.
    if (
      canRead &&
      getEffectiveRole(auth) === "member" &&
      assignedTo !== "__unassigned__"
    ) {
      assignedTo = auth.uid;
    }

    const monitorMode =
      request.nextUrl.searchParams.get("monitor") === "true" || (!canRead && canMonitor);

    const { listConversations } = await import("@/lib/firestore-repositories");
    let conversations = await listConversations(
      { companyId: context.companyId },
      {
        status: status as "open" | "closed" | undefined,
        unreadOnly,
        tag,
        assignedTo,
        search,
        window:
          windowParam === "open"
            ? "open"
            : windowParam === "closed"
              ? "closed"
              : undefined,
        period:
          periodParam === "today" ||
          periodParam === "yesterday" ||
          periodParam === "7d" ||
          periodParam === "30d"
            ? periodParam
            : undefined,
        noResponseOnly,
        connectionId,
        label,
      }
    );

    if (monitorMode) {
      conversations = conversations.map((c) => ({
        ...c,
        lastMessagePreview: undefined,
      }));
    }

    return NextResponse.json({ conversations, monitorMode });
  } catch (error) {
    console.error("[conversations GET]", error);
    return NextResponse.json({ error: "Erro ao listar conversas." }, { status: 500 });
  }
}
