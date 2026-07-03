export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { listCompanyPresence } from "@/lib/presence";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "team.view_online");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const users = await listCompanyPresence(authResult.context.companyId);
    const onlineCount = users.filter((u) => u.status === "online").length;
    return NextResponse.json({ users, onlineCount });
  } catch (error) {
    console.error("[presence GET]", error);
    return NextResponse.json({ error: "Erro ao listar presença." }, { status: 500 });
  }
}
