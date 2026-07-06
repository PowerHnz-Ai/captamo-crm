export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import {
  isAllowedMimeType,
  isImageMimeType,
  maxBytesForMime,
  uploadMediaLibraryAsset,
} from "@/lib/media-storage";
import type { MediaAssetSource } from "@/lib/types";

function canManageMedia(auth: { role?: string } | null): boolean {
  if (!auth) return false;
  const perm = requirePermission(auth as Parameters<typeof requirePermission>[0], "templates.manage");
  if (perm.ok) return true;
  const perm2 = requirePermission(auth as Parameters<typeof requirePermission>[0], "campaigns.manage");
  return perm2.ok;
}

export async function GET(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!canManageMedia(authResult.context.auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const scope = { companyId: authResult.context.companyId };
    const { listMediaAssets } = await import("@/lib/media-asset-repositories");
    const { getMediaSignedUrl } = await import("@/lib/media-storage");

    const assets = await listMediaAssets(scope, { imagesOnly: true, limit: 100 });
    const withPreview = await Promise.all(
      assets.map(async (asset) => {
        let previewUrl: string | undefined;
        try {
          previewUrl = await getMediaSignedUrl(asset.storagePath);
        } catch {
          previewUrl = undefined;
        }
        return { ...asset, previewUrl };
      })
    );

    return NextResponse.json({ assets: withPreview });
  } catch (error) {
    console.error("[media-library GET]", error);
    return NextResponse.json({ error: "Erro ao listar imagens." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  if (!canManageMedia(authResult.context.auth)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const name = String(formData.get("name") || "").trim();
    const source = (String(formData.get("source") || "manual") ||
      "manual") as MediaAssetSource;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedMimeType(mimeType) || !isImageMimeType(mimeType)) {
      return NextResponse.json(
        { error: "Envie uma imagem JPEG, PNG ou WebP." },
        { status: 400 }
      );
    }

    const maxBytes = maxBytesForMime(mimeType);
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Imagem excede ${Math.round(maxBytes / 1024 / 1024)}MB.` },
        { status: 400 }
      );
    }

    const scope = { companyId: authResult.context.companyId };
    const { createMediaAsset } = await import("@/lib/media-asset-repositories");

    const assetId = crypto.randomUUID().replace(/-/g, "");
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "image.jpg";

    const uploaded = await uploadMediaLibraryAsset({
      companyId: scope.companyId,
      assetId,
      buffer,
      mimeType,
      filename,
    });

    const asset = await createMediaAsset(
      {
        name: name || filename.replace(/\.[^.]+$/, ""),
        storagePath: uploaded.storagePath,
        mimeType,
        filename,
        source: ["template", "campaign", "manual"].includes(source)
          ? source
          : "manual",
      },
      scope,
      assetId
    );

    return NextResponse.json({
      asset,
      previewUrl: uploaded.signedUrl,
    });
  } catch (error) {
    console.error("[media-library POST]", error);
    const message = error instanceof Error ? error.message : "Erro ao enviar imagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
