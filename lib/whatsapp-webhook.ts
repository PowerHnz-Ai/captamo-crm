import {
  blockContactByPhone,
  createOrGetContactByPhone,
  createOrGetConversationByPhone,
  isOptOutMessage,
  saveInboundMessage,
  updateMessageStatusByWhatsAppId,
  type CompanyScope,
} from "./firestore-repositories";
import type { MessageStatus, MessageType } from "./types";

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id?: string;
        }>;
      };
    }>;
  }>;
}

function mapMessageType(type: string): MessageType {
  const allowed: MessageType[] = [
    "text",
    "template",
    "image",
    "audio",
    "document",
  ];
  return allowed.includes(type as MessageType) ? (type as MessageType) : "unknown";
}

function mapDeliveryStatus(status: string): MessageStatus {
  const map: Record<string, MessageStatus> = {
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
  };
  return map[status] || "accepted";
}

function extractBody(message: {
  type: string;
  text?: { body?: string };
}): string {
  if (message.type === "text" && message.text?.body) {
    return message.text.body;
  }
  return `[${message.type}]`;
}

export async function processWhatsAppWebhook(
  payload: MetaWebhookPayload,
  scope: CompanyScope
): Promise<void> {
  if (payload.object !== "whatsapp_business_account") {
    console.log("[webhook] Payload ignorado: objeto não é whatsapp_business_account");
    return;
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      const contactNames = new Map<string, string>();
      for (const c of value.contacts || []) {
        if (c.wa_id && c.profile?.name) {
          contactNames.set(c.wa_id, c.profile.name);
        }
      }

      for (const message of value.messages || []) {
        const phone = message.from;
        const body = extractBody(message);
        const contactName = contactNames.get(phone);

        console.log("[webhook] Mensagem inbound", { phone, type: message.type, body, companyId: scope.companyId });

        if (isOptOutMessage(body)) {
          console.log("[webhook] Opt-out detectado", phone);
          await blockContactByPhone(phone, scope);
        }

        const contact = await createOrGetContactByPhone(phone, scope, {
          name: contactName || phone,
          source: "whatsapp",
        });

        const conversation = await createOrGetConversationByPhone(phone, contact.id, scope);

        await saveInboundMessage({
          contactId: contact.id,
          conversationId: conversation.id,
          whatsappMessageId: message.id,
          type: mapMessageType(message.type),
          body,
          rawPayload: message,
        });
      }

      for (const statusUpdate of value.statuses || []) {
        const mapped = mapDeliveryStatus(statusUpdate.status);
        console.log("[webhook] Status update", {
          id: statusUpdate.id,
          status: mapped,
        });
        await updateMessageStatusByWhatsAppId(statusUpdate.id, mapped);
      }
    }
  }
}
