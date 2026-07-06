import { getSql } from "./db";
import { mediaAssetFromRow } from "./db-mappers";
import type { CompanyScope } from "./firestore-repositories";
import type { MediaAsset, MediaAssetSource } from "./types";

export async function listMediaAssets(
  scope: CompanyScope,
  options?: { imagesOnly?: boolean; limit?: number }
): Promise<MediaAsset[]> {
  const rows = await getSql().mediaAsset.findMany({
    where: {
      companyId: scope.companyId,
      ...(options?.imagesOnly ? { mimeType: { startsWith: "image/" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(options?.limit ? { take: options.limit } : {}),
  });
  return rows.map(mediaAssetFromRow);
}

export async function getMediaAssetById(
  id: string,
  scope: CompanyScope
): Promise<MediaAsset | null> {
  const row = await getSql().mediaAsset.findFirst({
    where: { id, companyId: scope.companyId },
  });
  return row ? mediaAssetFromRow(row) : null;
}

export async function createMediaAsset(
  data: {
    name: string;
    storagePath: string;
    mimeType: string;
    filename: string;
    source: MediaAssetSource;
  },
  scope: CompanyScope,
  id?: string
): Promise<MediaAsset> {
  const row = await getSql().mediaAsset.create({
    data: {
      ...(id ? { id } : {}),
      name: data.name,
      storagePath: data.storagePath,
      mimeType: data.mimeType,
      filename: data.filename,
      source: data.source,
      companyId: scope.companyId,
    },
  });
  return mediaAssetFromRow(row);
}
