export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { upsertPresence } from "@/lib/presence";

const heartbeatSchema = z.object({
  currentSurface: z.enum(["hub", "api", "checklist"]).default("api"),
  currentPath: z.string().optional(),
  status: z.enum(["online", "away", "offline"]).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const auth = authResult.context.auth!;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = heartbeatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    await upsertPresence({
      companyId: auth.companyId,
      uid: auth.uid,
      name: auth.email,
      email: auth.email,
      role: auth.role,
      cargo: auth.cargo,
      currentSurface: parsed.data.currentSurface,
      currentPath: parsed.data.currentPath,
      status: parsed.data.status,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[presence heartbeat]", error);
    return NextResponse.json({ error: "Erro ao atualizar presença." }, { status: 500 });
  }
}
