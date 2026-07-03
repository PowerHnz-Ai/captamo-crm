export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { previewCampaignSchema } from "@/lib/validators";
import { renderTemplateBody } from "@/lib/campaign-params";
import { buildCampaignParametersAsync } from "@/lib/campaign-params-server";
import { contactRefFieldKeysFromOrigin } from "@/lib/campaign-origin-defaults";

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = previewCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const { resolveUploadPreviewAudience } = await import("@/lib/campaign-audience");
    const audienceConfig = parsed.data.audienceConfig;

    let contacts;
    let invalidFromUpload = 0;
    let excludedRecentCount = 0;
    let excludedTagsCount = 0;
    let excludedClassesCount = 0;

    if (parsed.data.uploadPreview?.rows?.length) {
      const result = resolveUploadPreviewAudience(parsed.data.uploadPreview.rows);
      contacts = result.contacts;
      invalidFromUpload = result.invalid;
    } else {
      const { resolveCampaignAudienceWithExclusions } = await import(
        "@/lib/campaign-audience"
      );
      const result = await resolveCampaignAudienceWithExclusions(
        {
          contactListId: parsed.data.contactListId || audienceConfig?.contactListId,
          contactIds: parsed.data.contactIds || audienceConfig?.contactIds,
          tags: parsed.data.tags || audienceConfig?.tags,
          leadClasses: audienceConfig?.leadClasses,
          originId: parsed.data.originId || audienceConfig?.originId,
          originFieldFilters: audienceConfig?.originFieldFilters,
          audienceType: parsed.data.audienceType,
        },
        scope,
        {
          excludeRecentDays: parsed.data.excludeRecentDays,
          excludeTags: parsed.data.excludeTags,
          excludeLeadClasses: parsed.data.excludeLeadClasses,
        }
      );
      contacts = result.contacts;
      excludedRecentCount = result.excludedRecentCount;
      excludedTagsCount = result.excludedTagsCount;
      excludedClassesCount = result.excludedClassesCount;
    }

    const sample = contacts.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
    }));

    let renderedSamples: string[] = [];
    let hasImageHeader = false;
    let headerImagePreview: {
      assetId?: string;
      storagePath?: string;
      mode?: string;
      mapping?: string;
      previewUrl?: string;
      name?: string;
    } | null = null;

    if (parsed.data.templateName) {
      const { getTemplateByName } = await import("@/lib/template-repositories");
      const template = await getTemplateByName(parsed.data.templateName, scope);
      if (template) {
        hasImageHeader = template.header?.type === "IMAGE";

        if (hasImageHeader) {
          const mode = parsed.data.headerImageMode || "fixed";
          headerImagePreview = {
            mode,
            mapping: parsed.data.headerImageMapping,
            assetId: parsed.data.headerImageAssetId,
            storagePath: parsed.data.headerImageStoragePath,
          };

          const assetId = parsed.data.headerImageAssetId;
          if (assetId) {
            const { getMediaAssetById } = await import("@/lib/media-asset-repositories");
            const asset = await getMediaAssetById(assetId, scope);
            if (asset) {
              headerImagePreview.name = asset.name;
              try {
                const { getMediaSignedUrl } = await import("@/lib/media-storage");
                headerImagePreview.previewUrl = await getMediaSignedUrl(
                  asset.storagePath
                );
              } catch {
                headerImagePreview.previewUrl = undefined;
              }
            }
          } else if (parsed.data.headerImageStoragePath) {
            try {
              const { getMediaSignedUrl } = await import("@/lib/media-storage");
              headerImagePreview.previewUrl = await getMediaSignedUrl(
                parsed.data.headerImageStoragePath
              );
            } catch {
              headerImagePreview.previewUrl = undefined;
            }
          }
        }
      }
    }

    if (parsed.data.parameterMapping?.length && parsed.data.templateName) {
      const { getTemplateByName } = await import("@/lib/template-repositories");
      const template = await getTemplateByName(parsed.data.templateName, scope);
      if (template) {
        let contactRefKeys: Set<string> | undefined;
        const originId = parsed.data.originId || audienceConfig?.originId;
        if (originId) {
          const { getContactOriginById } = await import("@/lib/contact-origins");
          const origin = await getContactOriginById(originId, scope);
          contactRefKeys = contactRefFieldKeysFromOrigin(origin);
        }

        renderedSamples = [];
        for (const c of contacts.slice(0, 3)) {
          const params = await buildCampaignParametersAsync(
            c,
            parsed.data.parameterMapping!,
            scope,
            contactRefKeys
          );
          renderedSamples.push(renderTemplateBody(template.body, params));
        }
      }
    }

    return NextResponse.json({
      audienceCount: contacts.length,
      excludedRecentCount,
      excludedTagsCount,
      excludedClassesCount,
      invalidCount: invalidFromUpload,
      sample,
      renderedSamples,
      hasImageHeader,
      headerImage: headerImagePreview,
    });
  } catch (error) {
    console.error("[campaigns/preview]", error);
    return NextResponse.json({ error: "Erro ao gerar preview." }, { status: 500 });
  }
}
