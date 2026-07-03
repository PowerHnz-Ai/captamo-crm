export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import {
  createContactOriginSchema,
  updateContactOriginSchema,
} from "@/lib/validators";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { listContactOrigins } = await import("@/lib/contact-origins");
    const origins = await listContactOrigins({ companyId: authResult.context.companyId });
    return NextResponse.json({ origins });
  } catch (error) {
    console.error("[contact-origins GET]", error);
    return NextResponse.json({ error: "Erro ao listar origens." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "origins.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = createContactOriginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { createCustomContactOrigin } = await import("@/lib/contact-origins");
    const origin = await createCustomContactOrigin(parsed.data, {
      companyId: authResult.context.companyId,
    });
    return NextResponse.json({ origin }, { status: 201 });
  } catch (error) {
    console.error("[contact-origins POST]", error);
    return NextResponse.json({ error: "Erro ao criar origem." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "origins.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = updateContactOriginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { updateContactOrigin } = await import("@/lib/contact-origins");
    const origin = await updateContactOrigin(
      parsed.data.id,
      { label: parsed.data.label, fields: parsed.data.fields },
      { companyId: authResult.context.companyId }
    );

    if (!origin) {
      return NextResponse.json({ error: "Origem não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ origin });
  } catch (error) {
    console.error("[contact-origins PATCH]", error);
    return NextResponse.json({ error: "Erro ao atualizar origem." }, { status: 500 });
  }
}
