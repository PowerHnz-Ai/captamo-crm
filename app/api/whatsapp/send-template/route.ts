export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { canSendMessages } from "@/lib/messaging-limits";
import { resolveCompanyContext } from "@/lib/request-company";
import { incrementDailyStats } from "@/lib/stats-daily";
import { messageSenderFromAuth } from "@/lib/user-profiles";
import type { Contact } from "@/lib/types";
import { buildTemplateMessagePayload } from "@/lib/template-message-persist";
import { WhatsAppProviderError, extractMessageId } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { sendTemplateSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const context = await resolveCompanyContext(request);
  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = sendTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const limitCheck = await canSendMessages(context.companyId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 429 });
    }

    const {
      to,
      templateName,
      language,
      parameters,
      parameterMapping,
      headerImageAssetId,
      headerImageStoragePath,
      headerImageMode,
      headerImageMapping,
    } = parsed.data;
    const phone = normalizePhone(to);
    const scope = { companyId: context.companyId };

    const {
      createOrGetContactByPhone,
      createOrGetConversationByPhone,
      findContactByPhone,
      findConversationByPhone,
      saveOutboundMessage,
    } = await import("@/lib/firestore-repositories");

    const existingConversation = await findConversationByPhone(phone, scope);
    const activeConnectionId = existingConversation?.connectionId;

    const existing = await findContactByPhone(phone, scope);
    if (existing?.blocked) {
      return NextResponse.json(
        { error: "Contato bloqueado. Não é possível enviar mensagens." },
        { status: 403 }
      );
    }

    const contactForHeader: Contact =
      existing ||
      ({
        id: "",
        name: parameters[0] || phone,
        phone,
        source: "whatsapp",
        tags: [],
        optIn: true,
        blocked: false,
        createdAt: {} as Contact["createdAt"],
        updatedAt: {} as Contact["updatedAt"],
      } satisfies Omit<Contact, "id"> & { id: string });

    let resolvedParameters = parameters;

    if (parameterMapping?.length && existing) {
      const { buildCampaignParametersAsync } = await import(
        "@/lib/campaign-params-server"
      );
      const { contactRefFieldKeysFromOrigin } = await import(
        "@/lib/campaign-origin-defaults"
      );
      let contactRefKeys: Set<string> | undefined;
      if (existing.originId) {
        const { getContactOriginById } = await import("@/lib/contact-origins");
        const origin = await getContactOriginById(existing.originId, scope);
        contactRefKeys = contactRefFieldKeysFromOrigin(origin);
      }
      resolvedParameters = await buildCampaignParametersAsync(
        existing,
        parameterMapping,
        scope,
        contactRefKeys
      );
    }

    const emptyIndex = resolvedParameters.findIndex((value) => !value.trim());
    if (emptyIndex >= 0) {
      return NextResponse.json(
        {
          error: `A variável {{${emptyIndex + 1}}} está vazia. Preencha os campos de origem do contato no perfil ou ajuste o mapeamento.`,
        },
        { status: 400 }
      );
    }

    const { resolveHeaderImage } = await import("@/lib/campaign-header-image");
    const resolvedHeader = await resolveHeaderImage(
      contactForHeader,
      {
        headerImageMode: headerImageMode || "fixed",
        headerImageMapping,
        headerImageStoragePath,
        headerImageAssetId,
      },
      scope
    );

    const provider = await getWhatsAppProvider(
      context.companyId,
      activeConnectionId
    );
    const result = await provider.sendTemplate({
      to: phone,
      templateName,
      language,
      parameters: resolvedParameters,
      ...(resolvedHeader ? { headerImage: resolvedHeader } : {}),
    });

    const contact = await createOrGetContactByPhone(phone, scope, {
      name: resolvedParameters[0] || existing?.name || phone,
      source: existing?.source || "whatsapp",
    });

    const conversation = await createOrGetConversationByPhone(
      phone,
      contact.id,
      scope
    );

    const templatePayload = await buildTemplateMessagePayload(scope, {
      templateName,
      parameters: resolvedParameters,
      headerImageStoragePath: resolvedHeader?.storagePath || headerImageStoragePath,
    });

    await saveOutboundMessage({
      contactId: contact.id,
      conversationId: conversation.id,
      whatsappMessageId: result.messageId || extractMessageId(result.raw),
      type: "template",
      body: templatePayload.body,
      templateName: templatePayload.templateName,
      templateParameters: templatePayload.templateParameters,
      templateRenderedBody: templatePayload.templateRenderedBody,
      templateFooter: templatePayload.templateFooter,
      templateButtons: templatePayload.templateButtons,
      media: templatePayload.media,
      status: "accepted",
      connectionId: activeConnectionId,
      rawPayload: result.raw,
      ...messageSenderFromAuth(context.auth),
    });

    await incrementDailyStats(context.companyId, {
      templatesSent: 1,
      messagesSent: 1,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      contactId: contact.id,
      conversationId: conversation.id,
    });
  } catch (error) {
    if (error instanceof WhatsAppProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[send-template]", error);
    return NextResponse.json(
      { error: "Erro interno ao enviar template." },
      { status: 500 }
    );
  }
}
