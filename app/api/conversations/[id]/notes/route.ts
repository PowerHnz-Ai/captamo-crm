export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { canReadConversationContent } from "@/lib/permissions";
import { memberCanAccessConversation } from "@/lib/conversation-access";
import { messageSenderFromAuth } from "@/lib/user-profiles";

const noteSchema = z.object({
  body: z.string().min(1).max(4096),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const auth = authResult.context.auth!;
  if (!canReadConversationContent(auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const parsed = noteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const scope = { companyId: authResult.context.companyId };
    const { getConversationById, saveInternalNote } = await import(
      "@/lib/firestore-repositories"
    );

    const conversation = await getConversationById(id, scope);
    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }
    if (!memberCanAccessConversation(auth, conversation)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const note = await saveInternalNote(
      id,
      parsed.data.body.trim(),
      messageSenderFromAuth(auth),
      scope
    );

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("[conversations/notes POST]", error);
    return NextResponse.json({ error: "Erro ao salvar nota." }, { status: 500 });
  }
}
