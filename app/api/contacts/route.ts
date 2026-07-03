export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { WhatsAppProviderError } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/whatsapp/phone";
import {
  createContactSchema,
  importContactsSchema,
  updateContactSchema,
} from "@/lib/validators";
import { resolveCompanyContextOrError } from "@/lib/request-company";

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const tag = request.nextUrl.searchParams.get("tag") || undefined;
    const search = request.nextUrl.searchParams.get("search") || undefined;
    const originId = request.nextUrl.searchParams.get("originId") || undefined;
    const archived = request.nextUrl.searchParams.get("archived");

    const { listContacts } = await import("@/lib/firestore-repositories");
    const contacts = await listContacts(
      { companyId: authResult.context.companyId },
      {
        tag,
        search,
        originId,
        archived: archived === "true" ? true : archived === "false" ? false : undefined,
      }
    );
    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("[contacts GET]", error);
    return NextResponse.json({ error: "Erro ao listar contatos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = createContactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const phone = normalizePhone(parsed.data.phone);
    const { createContactManual } = await import("@/lib/firestore-repositories");
    const contact = await createContactManual(
      { ...parsed.data, phone },
      { companyId: authResult.context.companyId }
    );

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    if (error instanceof WhatsAppProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Já existe")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[contacts POST]", error);
    return NextResponse.json({ error: "Erro ao criar contato." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const id = body.id as string;
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const parsed = updateContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { getContactById, updateContact } = await import(
      "@/lib/firestore-repositories"
    );
    const scope = { companyId: authResult.context.companyId };
    const existing = await getContactById(id, scope);
    if (!existing) {
      return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
    }

    const updates = { ...parsed.data };
    if (updates.phone) {
      updates.phone = normalizePhone(updates.phone);
    }

    await updateContact(id, updates);
    const updated = await getContactById(id, scope);
    return NextResponse.json({ contact: updated });
  } catch (error) {
    if (error instanceof WhatsAppProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[contacts PATCH]", error);
    return NextResponse.json({ error: "Erro ao atualizar contato." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const id =
      request.nextUrl.searchParams.get("id") ||
      (await request.json().catch(() => ({})))?.id;
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const { deleteContact } = await import("@/lib/firestore-repositories");
    const removed = await deleteContact(id, {
      companyId: authResult.context.companyId,
    });
    if (!removed) {
      return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[contacts DELETE]", error);
    return NextResponse.json({ error: "Erro ao excluir contato." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = importContactsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rows = parsed.data.contacts.map((c) => ({
      ...c,
      phone: normalizePhone(c.phone),
    }));

    const { importContacts } = await import("@/lib/firestore-repositories");
    const result = await importContacts(rows, {
      companyId: authResult.context.companyId,
    }, {
      duplicatePolicy: parsed.data.duplicatePolicy,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[contacts import]", error);
    return NextResponse.json({ error: "Erro na importação." }, { status: 500 });
  }
}
