export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAssignmentSettings,
  updateAssignmentSettings,
} from "@/lib/assignment-settings";
import { canManageTeamRoles } from "@/lib/permissions";
import { resolveCompanyContext } from "@/lib/request-company";

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["auto", "manual"]).optional(),
  strategy: z.enum(["least_load", "round_robin"]).optional(),
  eligibleMemberUids: z.array(z.string()).optional(),
  maxOpenPerMember: z.number().int().positive().nullable().optional(),
  reassignIfClosed: z.boolean().optional(),
  windowDays: z.number().int().min(1).max(90).optional(),
  inboxAttendantUids: z.array(z.string()).optional(),
  inboxAttendantOrder: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!canManageTeamRoles(context.auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const settings = await getAssignmentSettings(context.companyId);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[settings/assignment GET]", error);
    return NextResponse.json(
      { error: "Erro ao carregar configurações." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!canManageTeamRoles(context.auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const body = settingsSchema.parse(await request.json());
    const patch = {
      ...body,
      maxOpenPerMember:
        body.maxOpenPerMember === null ? undefined : body.maxOpenPerMember,
    };
    const settings = await updateAssignmentSettings(context.companyId, patch);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[settings/assignment PUT]", error);
    return NextResponse.json(
      { error: "Erro ao salvar configurações." },
      { status: 500 }
    );
  }
}
