import type { CompanyScope } from "./firestore-repositories";
import { buildReplyPreview } from "./message-reply-preview";
import type { NormalizedInboundMessage } from "./whatsapp/types";

export async function resolveInboundReplyTo(
  event: NormalizedInboundMessage,
  conversationId: string,
  contactName: string,
  scope: CompanyScope
) {
  if (!event.replyToWhatsappMessageId) return undefined;

  const { resolveWhatsAppMessageRef } = await import("./whatsapp-message-refs");
  const { getConversationMessage } = await import("./firestore-repositories");

  const ref = await resolveWhatsAppMessageRef(event.replyToWhatsappMessageId);
  if (ref && ref.conversationId === conversationId) {
    const target = await getConversationMessage(
      conversationId,
      ref.messageId,
      scope
    );
    if (target) {
      const senderLabel =
        target.direction === "outbound" ? "Você" : contactName || "Contato";
      return buildReplyPreview(target, senderLabel);
    }
  }

  return {
    whatsappMessageId: event.replyToWhatsappMessageId,
    body: "Mensagem",
    senderLabel: "Você",
  };
}
