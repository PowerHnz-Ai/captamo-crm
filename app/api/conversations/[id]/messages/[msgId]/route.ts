export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContext } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { WhatsAppProviderError, getWhatsAppProvider } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/whatsapp/phone";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const context = await resolveCompanyContext(request);
  if (!context?.auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const perm = requirePermission(context.auth, "conversations.reply");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const { id, msgId } = await params;
    const scope = { companyId: context.companyId };

    const { getConversationById, getConversationMessage, markMessageDeleted } =
      await import("@/lib/firestore-repositories");

    const conversation = await getConversationById(id, scope);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 }
      );
    }

    const message = await getConversationMessage(id, msgId, scope);
    if (!message) {
      return NextResponse.json(
        { error: "Mensagem não encontrada." },
        { status: 404 }
      );
    }
    if (!message.whatsappMessageId) {
      return NextResponse.json(
        { error: "Mensagem sem ID do WhatsApp." },
        { status: 400 }
      );
    }

    const { getConnectionProvider } = await import("@/lib/connections");
    const providerType = await getConnectionProvider(
      scope.companyId,
      conversation.connectionId
    );
    if (providerType === "meta_cloud") {
      return NextResponse.json(
        { error: "Apagar para todos não é suportado pela API oficial da Meta." },
        { status: 400 }
      );
    }

    const provider = await getWhatsAppProvider(
      scope.companyId,
      conversation.connectionId
    );
    if (!provider.deleteMessageForEveryone) {
      return NextResponse.json(
        { error: "Provedor não suporta apagar para todos." },
        { status: 400 }
      );
    }

    let remoteJid: string;
    try {
      remoteJid = `${normalizePhone(conversation.phone)}@s.whatsapp.net`;
    } catch {
      remoteJid = `${conversation.phone.replace(/\D/g, "")}@s.whatsapp.net`;
    }

    await provider.deleteMessageForEveryone({
      whatsappMessageId: message.whatsappMessageId,
      remoteJid,
      fromMe: message.direction === "outbound",
    });

    await markMessageDeleted(id, msgId, scope);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof WhatsAppProviderError) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "Não foi possível apagar. O prazo para apagar pode ter expirado.",
        },
        { status: 400 }
      );
    }
    console.error("[messages DELETE]", error);
    return NextResponse.json(
      { error: "Erro interno ao apagar mensagem." },
      { status: 500 }
    );
  }
}
