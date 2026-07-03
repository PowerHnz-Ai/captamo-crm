export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { markPresenceOffline } from "@/lib/presence";

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const auth = authResult.context.auth!;

  try {
    await markPresenceOffline(auth.companyId, auth.uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[presence offline]", error);
    return NextResponse.json({ error: "Erro ao marcar offline." }, { status: 500 });
  }
}
