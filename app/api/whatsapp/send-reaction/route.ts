export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { canReadConversationContent } from "@/lib/permissions";
import { memberCanAccessConversation } from "@/lib/conversation-access";
import { WhatsAppNotConfiguredError, WhatsAppProviderError, getWhatsAppProvider } from "@/lib/whatsapp";

const reactionSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  /** Emoji da reação; string vazia remove. */
  emoji: z.string().max(16),
});

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const auth = authResult.context.auth!;
  if (!canReadConversationContent(auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const parsed = reactionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const { conversationId, messageId, emoji } = parsed.data;

    const scope = { companyId: authResult.context.companyId };
    const { getConversationById, getConversationMessage, applyMessageReaction } =
      await import("@/lib/firestore-repositories");

    const conversation = await getConversationById(conversationId, scope);
    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }
    if (!memberCanAccessConversation(auth, conversation)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const message = await getConversationMessage(conversationId, messageId, scope);
    if (!message) {
      return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
    }
    if (!message.whatsappMessageId) {
      return NextResponse.json(
        { error: "Mensagem sem referência no WhatsApp — não é possível reagir." },
        { status: 422 }
      );
    }

    const provider = await getWhatsAppProvider(
      scope.companyId,
      conversation.connectionId
    );
    if (!provider.sendReaction) {
      return NextResponse.json(
        { error: "Este provedor de WhatsApp não suporta reações." },
        { status: 422 }
      );
    }

    await provider.sendReaction({
      to: conversation.phone,
      targetWhatsappMessageId: message.whatsappMessageId,
      emoji,
    });

    await applyMessageReaction(
      conversationId,
      messageId,
      { emoji, from: "business" },
      scope
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof WhatsAppNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof WhatsAppProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[send-reaction]", error);
    return NextResponse.json({ error: "Erro ao enviar reação." }, { status: 500 });
  }
}
