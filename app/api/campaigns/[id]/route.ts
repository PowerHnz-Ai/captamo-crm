export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import { updateCampaignSchema } from "@/lib/validators";
import type { Contact } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    const scope = { companyId: authResult.context.companyId };
    const { getCampaign, updateCampaignStatus, runCampaignBatches } = await import(
      "@/lib/campaign-queue"
    );

    const campaign = await getCampaign(id, scope);
    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
    }

    if (action === "start") {
      const now = Date.now();
      if (campaign.scheduledAt && campaign.scheduledAt > now) {
        return NextResponse.json(
          { error: "Campanha agendada para o futuro." },
          { status: 400 }
        );
      }
      await updateCampaignStatus(id, "running", scope);
      const result = await runCampaignBatches(id, scope);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "pause") {
      await updateCampaignStatus(id, "paused", scope);
      return NextResponse.json({ success: true, status: "paused" });
    }

    if (action === "run") {
      const result = await runCampaignBatches(id, scope);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "duplicate") {
      const perm = requirePermission(authResult.context.auth, "campaigns.manage");
      if (!perm.ok) {
        return NextResponse.json({ error: perm.error }, { status: perm.status });
      }
      const { duplicateCampaign } = await import("@/lib/campaign-queue");
      const copy = await duplicateCampaign(id, scope);
      return NextResponse.json({ success: true, campaign: copy }, { status: 201 });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("[campaigns POST id]", error);
    const message =
      error instanceof Error ? error.message : "Erro ao executar campanha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const { id } = await params;
    const { getCampaign } = await import("@/lib/campaign-queue");
    const campaign = await getCampaign(id, {
      companyId: authResult.context.companyId,
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("[campaigns GET id]", error);
    return NextResponse.json({ error: "Erro ao carregar campanha." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "campaigns.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const { getCampaign, updateCampaignFields, deleteCampaignJobs } =
      await import("@/lib/campaign-queue");

    const campaign = await getCampaign(id, scope);
    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
    }
    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Apenas campanhas em rascunho podem ser editadas." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const templateName = data.templateName || campaign.templateName;

    // Valida template/mapeamento quando relevante.
    if (data.templateName || data.parameterMapping) {
      const { getTemplateByName } = await import("@/lib/template-repositories");
      const {
        validateApprovedTemplate,
        validateCampaignParameterMapping,
      } = await import("@/lib/template-validation");
      const templateCheck = validateApprovedTemplate(
        await getTemplateByName(templateName, scope),
        templateName
      );
      if (!templateCheck.ok) {
        return NextResponse.json({ error: templateCheck.error }, { status: 400 });
      }
      const mapping = data.parameterMapping || campaign.parameterMapping || [];
      const mappingCheck = validateCampaignParameterMapping(
        templateCheck.template,
        mapping
      );
      if (!mappingCheck.ok) {
        return NextResponse.json({ error: mappingCheck.error }, { status: 400 });
      }
    }

    // Recalcula público apenas se algum seletor de audiência foi enviado.
    const audienceProvided =
      data.contactListId !== undefined ||
      data.contactIds !== undefined ||
      data.tags !== undefined ||
      data.audienceType !== undefined ||
      data.audienceConfig !== undefined ||
      data.contactOriginId !== undefined;

    const exclusionChanged =
      data.excludeRecentDays !== undefined ||
      data.excludeTags !== undefined ||
      data.excludeLeadClasses !== undefined;

    let totalContacts = campaign.totalContacts;
    let recomputedContacts: Contact[] | null = null;
    const excludeRecentDays =
      data.excludeRecentDays !== undefined
        ? data.excludeRecentDays ?? undefined
        : campaign.excludeRecentDays;
    const excludeTags =
      data.excludeTags !== undefined ? data.excludeTags ?? undefined : campaign.excludeTags;
    const excludeLeadClasses =
      data.excludeLeadClasses !== undefined
        ? data.excludeLeadClasses ?? undefined
        : campaign.excludeLeadClasses;

    if (audienceProvided || exclusionChanged) {
      const { resolveCampaignAudienceWithExclusions } = await import(
        "@/lib/campaign-audience"
      );
      const nextAudienceType = data.audienceType ?? campaign.audienceType;
      const nextOriginId =
        data.contactOriginId ??
        data.audienceConfig?.originId ??
        campaign.contactOriginId ??
        campaign.audienceConfig?.originId;
      const result = await resolveCampaignAudienceWithExclusions(
        {
          contactListId: data.contactListId ?? campaign.contactListId,
          contactIds:
            data.contactIds ??
            data.audienceConfig?.contactIds ??
            campaign.audienceConfig?.contactIds,
          tags:
            data.tags ??
            data.audienceConfig?.tags ??
            campaign.audienceConfig?.tags,
          leadClasses:
            data.audienceConfig?.leadClasses ?? campaign.audienceConfig?.leadClasses,
          originId: nextOriginId,
          originFieldFilters:
            data.audienceConfig?.originFieldFilters ??
            campaign.audienceConfig?.originFieldFilters,
          audienceType: nextAudienceType,
        },
        scope,
        {
          excludeRecentDays: excludeRecentDays ?? undefined,
          excludeTags: excludeTags ?? undefined,
          excludeLeadClasses: excludeLeadClasses ?? undefined,
          excludeCampaignId: id,
        }
      );
      recomputedContacts = result.contacts;
      totalContacts = result.contacts.length;
    }

    const scheduledAt =
      data.scheduledAt === undefined
        ? undefined
        : data.scheduledAt === null
          ? null
          : new Date(data.scheduledAt).getTime();

    const scheduledEndAt =
      data.scheduledEndAt === undefined
        ? undefined
        : data.scheduledEndAt === null
          ? null
          : new Date(data.scheduledEndAt).getTime();

    const dispatchChanged =
      data.dispatchMode !== undefined ||
      data.cadenceConfig !== undefined ||
      scheduledAt !== undefined ||
      scheduledEndAt !== undefined;

    const updated = await updateCampaignFields(
      id,
      {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.templateName !== undefined
          ? { templateName: data.templateName }
          : {}),
        ...(data.templateLanguage !== undefined
          ? { templateLanguage: data.templateLanguage }
          : {}),
        ...(data.contactListId !== undefined
          ? { contactListId: data.contactListId }
          : {}),
        ...(data.maxSendsPerRun !== undefined
          ? { maxSendsPerRun: data.maxSendsPerRun }
          : {}),
        ...(data.parameterMapping !== undefined
          ? { parameterMapping: data.parameterMapping }
          : {}),
        ...(data.audienceType !== undefined ? { audienceType: data.audienceType } : {}),
        ...(data.audienceConfig !== undefined
          ? { audienceConfig: data.audienceConfig }
          : {}),
        ...(data.contactOriginId !== undefined
          ? { contactOriginId: data.contactOriginId }
          : {}),
        ...(data.contactOriginKey !== undefined
          ? { contactOriginKey: data.contactOriginKey }
          : {}),
        ...(data.dispatchMode !== undefined ? { dispatchMode: data.dispatchMode } : {}),
        ...(data.cadenceConfig !== undefined ? { cadenceConfig: data.cadenceConfig } : {}),
        ...(data.dailySendLimit !== undefined
          ? { dailySendLimit: data.dailySendLimit }
          : {}),
        ...(data.quietHours !== undefined ? { quietHours: data.quietHours } : {}),
        ...(data.duplicatePolicy !== undefined
          ? { duplicatePolicy: data.duplicatePolicy }
          : {}),
        ...(data.excludeRecentDays !== undefined
          ? { excludeRecentDays: data.excludeRecentDays }
          : {}),
        ...(data.excludeTags !== undefined ? { excludeTags: data.excludeTags } : {}),
        ...(data.excludeLeadClasses !== undefined
          ? { excludeLeadClasses: data.excludeLeadClasses }
          : {}),
        ...(data.headerImageAssetId !== undefined
          ? { headerImageAssetId: data.headerImageAssetId }
          : {}),
        ...(data.headerImageStoragePath !== undefined
          ? { headerImageStoragePath: data.headerImageStoragePath }
          : {}),
        ...(data.headerImageMode !== undefined
          ? { headerImageMode: data.headerImageMode }
          : {}),
        ...(data.headerImageMapping !== undefined
          ? { headerImageMapping: data.headerImageMapping }
          : {}),
        ...(scheduledAt !== undefined ? { scheduledAt } : {}),
        ...(scheduledEndAt !== undefined ? { scheduledEndAt } : {}),
        ...(audienceProvided || exclusionChanged ? { totalContacts } : {}),
      },
      scope
    );

    const shouldRebuildJobs =
      recomputedContacts ||
      data.parameterMapping !== undefined ||
      data.headerImageAssetId !== undefined ||
      data.headerImageStoragePath !== undefined ||
      data.headerImageMode !== undefined ||
      data.headerImageMapping !== undefined ||
      dispatchChanged ||
      exclusionChanged;

    if (shouldRebuildJobs) {
      const { enqueueCampaignJobsForContacts } = await import("@/lib/campaign-queue");
      const mapping = data.parameterMapping || campaign.parameterMapping || [];
      let contactsForJobs = recomputedContacts;

      if (!contactsForJobs) {
        const { resolveCampaignAudienceWithExclusions } = await import(
          "@/lib/campaign-audience"
        );
        const result = await resolveCampaignAudienceWithExclusions(
          {
            contactListId:
              updated.contactListId ||
              updated.audienceConfig?.contactListId ||
              campaign.contactListId,
            contactIds:
              updated.audienceConfig?.contactIds ||
              campaign.audienceConfig?.contactIds,
            tags:
              updated.audienceConfig?.tags ||
              campaign.audienceConfig?.tags ||
              data.tags,
            leadClasses:
              updated.audienceConfig?.leadClasses ||
              campaign.audienceConfig?.leadClasses,
            originId:
              updated.contactOriginId ||
              updated.audienceConfig?.originId ||
              campaign.contactOriginId ||
              campaign.audienceConfig?.originId,
            originFieldFilters:
              updated.audienceConfig?.originFieldFilters ||
              campaign.audienceConfig?.originFieldFilters,
            audienceType: updated.audienceType || campaign.audienceType,
          },
          scope,
          {
            excludeRecentDays: updated.excludeRecentDays,
            excludeTags: updated.excludeTags,
            excludeLeadClasses: updated.excludeLeadClasses,
            excludeCampaignId: id,
          }
        );
        contactsForJobs = result.contacts;
      }

      let contactRefKeys: Set<string> | undefined;
      const originIdForRefs =
        updated.contactOriginId ||
        updated.audienceConfig?.originId ||
        campaign.contactOriginId;
      if (originIdForRefs) {
        const { getContactOriginById } = await import("@/lib/contact-origins");
        const { contactRefFieldKeysFromOrigin } = await import(
          "@/lib/campaign-origin-defaults"
        );
        const origin = await getContactOriginById(originIdForRefs, scope);
        contactRefKeys = contactRefFieldKeysFromOrigin(origin);
      }

      await deleteCampaignJobs(id);
      if (contactsForJobs && contactsForJobs.length > 0) {
        await enqueueCampaignJobsForContacts(
          id,
          updated,
          contactsForJobs,
          mapping,
          scope,
          contactRefKeys
        );
      }
    }

    return NextResponse.json({ campaign: updated });
  } catch (error) {
    console.error("[campaigns PATCH id]", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar campanha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "campaigns.manage");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const { id } = await params;
    const scope = { companyId: authResult.context.companyId };
    const { deleteCampaign } = await import("@/lib/campaign-queue");
    const removed = await deleteCampaign(id, scope);
    if (!removed) {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[campaigns DELETE id]", error);
    return NextResponse.json({ error: "Erro ao excluir campanha." }, { status: 500 });
  }
}
