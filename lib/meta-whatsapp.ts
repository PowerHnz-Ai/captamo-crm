/** @deprecated Use lib/whatsapp instead */
export {
  WhatsAppProviderError as MetaWhatsAppError,
  normalizePhone,
  extractMessageId as extractWhatsAppMessageId,
} from "./whatsapp";

import { getWhatsAppProvider } from "./whatsapp";
import type { SendTemplateParams, SendTextParams } from "./whatsapp";

export async function sendTemplateMessage(
  params: SendTemplateParams & { companyId?: string }
) {
  const companyId =
    params.companyId || process.env.CRM_DEFAULT_COMPANY_ID?.trim();
  if (!companyId) {
    throw new Error("companyId obrigatório para envio.");
  }
  const provider = await getWhatsAppProvider(companyId);
  const result = await provider.sendTemplate(params);
  return result.raw;
}

export async function sendTextMessage(
  params: SendTextParams & { companyId?: string }
) {
  const companyId =
    params.companyId || process.env.CRM_DEFAULT_COMPANY_ID?.trim();
  if (!companyId) {
    throw new Error("companyId obrigatório para envio.");
  }
  const provider = await getWhatsAppProvider(companyId);
  const result = await provider.sendText(params);
  return result.raw;
}
