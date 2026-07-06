export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { createCampaignSchema } from "@/lib/validators";
import type { Campaign, CampaignAudienceType, Contact } from "@/lib/types";

function inferAudienceType(data: {
  contactListId?: string;
  contactIds?: string[];
  tags?: string[];
  audienceType?: CampaignAudienceType;
  contactOriginId?: string;
  audienceConfig?: Campaign["audienceConfig"];
}): CampaignAudienceType {
  if (data.audienceType) return data.audienceType;
  if (data.audienceConfig?.leadClasses?.length) return "classes";
  if (data.contactOriginId || data.audienceConfig?.originId) return "origin";
  if (data.contactListId || data.audienceConfig?.contactListId) return "list";
  if (data.contactIds?.length || data.audienceConfig?.contactIds?.length) return "manual";
  if (data.tags?.length || data.audienceConfig?.tags?.length) return "tags";
  return "all";
}

function buildAudienceConfig(
  parsed: ReturnType<typeof createCampaignSchema.parse>
): Campaign["audienceConfig"] {
  if (parsed.audienceConfig) {
    return {
      ...parsed.audienceConfig,
      ...(parsed.contactOriginId && !parsed.audienceConfig.originId
        ? { originId: parsed.contactOriginId }
        : {}),
    };
  }
  return {
    ...(parsed.tags?.length ? { tags: parsed.tags } : {}),
    ...(parsed.contactListId ? { contactListId: parsed.contactListId } : {}),
    ...(parsed.contactIds?.length ? { contactIds: parsed.contactIds } : {}),
    ...(parsed.contactOriginId ? { originId: parsed.contactOriginId } : {}),
  };
}

function buildCampaignPayloadFields(parsed: ReturnType<typeof createCampaignSchema.parse>) {
  const scheduledAt = parsed.scheduledAt
    ? new Date(parsed.scheduledAt).getTime()
    : undefined;
  const scheduledEndAt = parsed.scheduledEndAt
    ? new Date(parsed.scheduledEndAt).getTime()
    : undefined;
  const audienceType = inferAudienceType(parsed);
  const audienceConfig = buildAudienceConfig(parsed);

  return {
    audienceType,
    audienceConfig,
    ...(parsed.dispatchMode ? { dispatchMode: parsed.dispatchMode } : {}),
    ...(parsed.cadenceConfig ? { cadenceConfig: parsed.cadenceConfig } : {}),
    ...(parsed.dailySendLimit ? { dailySendLimit: parsed.dailySendLimit } : {}),
    ...(parsed.quietHours ? { quietHours: parsed.quietHours } : {}),
    ...(parsed.duplicatePolicy ? { duplicatePolicy: parsed.duplicatePolicy } : {}),
    ...(parsed.excludeRecentDays ? { excludeRecentDays: parsed.excludeRecentDays } : {}),
    ...(parsed.excludeTags?.length ? { excludeTags: parsed.excludeTags } : {}),
    ...(parsed.excludeLeadClasses?.length
      ? { excludeLeadClasses: parsed.excludeLeadClasses }
      : {}),
    ...(parsed.contactOriginId ? { contactOriginId: parsed.contactOriginId } : {}),
    ...(parsed.contactOriginKey ? { contactOriginKey: parsed.contactOriginKey } : {}),
    ...(parsed.headerImageAssetId
      ? { headerImageAssetId: parsed.headerImageAssetId }
      : {}),
    ...(parsed.headerImageStoragePath
      ? { headerImageStoragePath: parsed.headerImageStoragePath }
      : {}),
    ...(parsed.headerImageMode ? { headerImageMode: parsed.headerImageMode } : {}),
    ...(parsed.headerImageMapping
      ? { headerImageMapping: parsed.headerImageMapping }
      : {}),
    ...(scheduledEndAt ? { scheduledEndAt } : {}),
    ...(scheduledAt ? { scheduledAt } : {}),
  };
}

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { listCampaigns } = await import("@/lib/campaign-queue");
    const campaigns = await listCampaigns({ companyId: authResult.context.companyId });
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("[campaigns GET]", error);
    return NextResponse.json({ error: "Erro ao listar campanhas." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "campaigns.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const { resolveCampaignAudienceWithExclusions } = await import("@/lib/campaign-audience");
    const { getTemplateByName } = await import("@/lib/template-repositories");
    const {
      validateApprovedTemplate,
      validateCampaignParameterMapping,
    } = await import("@/lib/template-validation");

    const templateCheck = validateApprovedTemplate(
      await getTemplateByName(parsed.data.templateName, scope),
      parsed.data.templateName
    );
    if (!templateCheck.ok) {
      return NextResponse.json({ error: templateCheck.error }, { status: 400 });
    }

    const mapping = parsed.data.parameterMapping;
    const mappingCheck = validateCampaignParameterMapping(templateCheck.template, mapping);
    if (!mappingCheck.ok) {
      return NextResponse.json({ error: mappingCheck.error }, { status: 400 });
    }

    const audienceType = inferAudienceType(parsed.data);
    const audienceConfig = buildAudienceConfig(parsed.data);
    const originId =
      parsed.data.contactOriginId || audienceConfig?.originId;

    const { contacts } = await resolveCampaignAudienceWithExclusions(
      {
        contactListId: parsed.data.contactListId || audienceConfig?.contactListId,
        contactIds: parsed.data.contactIds || audienceConfig?.contactIds,
        tags: parsed.data.tags || audienceConfig?.tags,
        leadClasses: audienceConfig?.leadClasses,
        originId,
        originFieldFilters: audienceConfig?.originFieldFilters,
        audienceType,
      },
      scope,
      {
        excludeRecentDays: parsed.data.excludeRecentDays,
        excludeTags: parsed.data.excludeTags,
        excludeLeadClasses: parsed.data.excludeLeadClasses,
      }
    );

    let contactRefKeys: Set<string> | undefined;
    if (parsed.data.contactOriginId) {
      const { getContactOriginById } = await import("@/lib/contact-origins");
      const { contactRefFieldKeysFromOrigin } = await import(
        "@/lib/campaign-origin-defaults"
      );
      const origin = await getContactOriginById(parsed.data.contactOriginId, scope);
      contactRefKeys = contactRefFieldKeysFromOrigin(origin);
    }

    const { createCampaign, enqueueCampaignJobsForContacts } = await import(
      "@/lib/campaign-queue"
    );

    const extraFields = buildCampaignPayloadFields(parsed.data);

    const campaign = await createCampaign(
      {
        name: parsed.data.name,
        templateName: parsed.data.templateName,
        templateLanguage: parsed.data.templateLanguage,
        status: "draft",
        ...(parsed.data.contactListId
          ? { contactListId: parsed.data.contactListId }
          : {}),
        maxSendsPerRun: parsed.data.maxSendsPerRun,
        parameterMapping: parsed.data.parameterMapping,
        totalContacts: contacts.length,
        dispatchMode: parsed.data.dispatchMode || "immediate",
        ...extraFields,
        ...(parsed.data.importStats ? { importStats: parsed.data.importStats } : {}),
        ...(parsed.data.contactOriginId
          ? { contactOriginId: parsed.data.contactOriginId }
          : {}),
        ...(parsed.data.contactOriginKey
          ? { contactOriginKey: parsed.data.contactOriginKey }
          : {}),
      },
      scope
    );

    if (contacts.length > 0) {
      await enqueueCampaignJobsForContacts(
        campaign.id,
        { ...campaign, dispatchMode: parsed.data.dispatchMode || "immediate", ...extraFields },
        contacts,
        mapping,
        scope,
        contactRefKeys
      );
    }

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("[campaigns POST]", error);
    const message =
      error instanceof Error ? error.message : "Erro ao criar campanha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
