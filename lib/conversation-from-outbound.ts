import type { Contact, Conversation } from "./types";
import type { CompanyScope } from "./firestore-repositories";
import {
  createOrGetContactByPhone,
  createOrGetConversationByPhone,
  saveOutboundMessage,
  updateContact,
} from "./firestore-repositories";
import { incrementDailyStats } from "./stats-daily";
import { buildTemplateMessagePayload } from "./template-message-persist";
import {
  extractMessageStatus,
  extractResolvedWhatsAppId,
  normalizePhone,
} from "./whatsapp/phone";

export interface PersistOutboundTemplateInput {
  scope: CompanyScope;
  phone: string;
  contactName?: string;
  templateName: string;
  parameters?: string[];
  headerImageStoragePath?: string;
  messageId?: string;
  raw?: unknown;
  body?: string;
  trackStats?: boolean;
}

export interface PersistOutboundTemplateResult {
  contact: Contact;
  conversation: Conversation;
  deliveryPhone: string;
  messageStatus: string;
}

export async function persistOutboundTemplateMessage(
  input: PersistOutboundTemplateInput
): Promise<PersistOutboundTemplateResult> {
  const phone = normalizePhone(input.phone);
  const deliveryPhone =
    (input.raw ? extractResolvedWhatsAppId(input.raw) : null) || phone;
  const messageStatus =
    (input.raw ? extractMessageStatus(input.raw) : null) || "accepted";

  const contact = await createOrGetContactByPhone(deliveryPhone, input.scope, {
    name: input.contactName || deliveryPhone,
  });

  if (contact.phone !== deliveryPhone) {
    await updateContact(contact.id, { phone: deliveryPhone });
  }

  const conversation = await createOrGetConversationByPhone(
    deliveryPhone,
    contact.id,
    input.scope
  );

  const templatePayload = input.body
    ? null
    : await buildTemplateMessagePayload(input.scope, {
        templateName: input.templateName,
        parameters: input.parameters,
        headerImageStoragePath: input.headerImageStoragePath,
      });

  const body = input.body || templatePayload?.body || `Template: ${input.templateName}`;

  await saveOutboundMessage({
    contactId: contact.id,
    conversationId: conversation.id,
    whatsappMessageId: input.messageId,
    type: "template",
    body: templatePayload?.body || body,
    templateName: templatePayload?.templateName || input.templateName,
    templateParameters: templatePayload?.templateParameters,
    templateRenderedBody: templatePayload?.templateRenderedBody,
    templateFooter: templatePayload?.templateFooter,
    templateButtons: templatePayload?.templateButtons,
    media: templatePayload?.media,
    status: "accepted",
    rawPayload: input.raw,
  });

  if (input.trackStats !== false) {
    await incrementDailyStats(input.scope.companyId, {
      templatesSent: 1,
      messagesSent: 1,
    });
  }

  return { contact, conversation, deliveryPhone, messageStatus };
}
