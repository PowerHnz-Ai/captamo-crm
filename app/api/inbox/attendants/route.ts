export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAssignmentSettings } from "@/lib/assignment-settings";
import { listAttendants } from "@/lib/lead-assignment";
import { canReadConversationContent } from "@/lib/permissions";
import { resolveCompanyContext } from "@/lib/request-company";
import { resolveUserPhotoUrl } from "@/lib/user-profiles";

export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!canReadConversationContent(context.auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const scope = { companyId: context.companyId };
    const [settings, members] = await Promise.all([
      getAssignmentSettings(context.companyId),
      listAttendants(scope),
    ]);

    const allowedUids =
      settings.inboxAttendantUids && settings.inboxAttendantUids.length > 0
        ? new Set(settings.inboxAttendantUids)
        : null;

    const filtered = members.filter((m) => !allowedUids || allowedUids.has(m.uid));

    let attendants = await Promise.all(
      filtered.map(async (m) => ({
        uid: m.uid,
        name: m.name || m.email || m.uid,
        photoUrl: await resolveUserPhotoUrl(m),
      }))
    );

    if (settings.inboxAttendantOrder?.length) {
      const order = new Map(
        settings.inboxAttendantOrder.map((uid, index) => [uid, index])
      );
      attendants = [...attendants].sort((a, b) => {
        const ai = order.get(a.uid) ?? 9999;
        const bi = order.get(b.uid) ?? 9999;
        if (ai !== bi) return ai - bi;
        return a.name.localeCompare(b.name, "pt-BR");
      });
    } else {
      attendants.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }

    return NextResponse.json({ attendants });
  } catch (error) {
    console.error("[inbox/attendants GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar atendentes." },
      { status: 500 }
    );
  }
}
