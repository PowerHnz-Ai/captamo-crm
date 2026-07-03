import type { Campaign, Contact } from "./types";
import type { CompanyScope } from "./firestore-repositories";
import { templateHasImageHeader } from "./campaign-params";

export { templateHasImageHeader };

export interface ResolvedHeaderImage {
  storagePath?: string;
  link?: string;
}

export async function resolveHeaderImage(
  contact: Contact,
  campaign: Pick<
    Campaign,
    | "headerImageMode"
    | "headerImageMapping"
    | "headerImageStoragePath"
    | "headerImageAssetId"
  >,
  scope: CompanyScope
): Promise<ResolvedHeaderImage | undefined> {
  const mode = campaign.headerImageMode || "fixed";

  if (mode === "fixed") {
    if (campaign.headerImageStoragePath) {
      return { storagePath: campaign.headerImageStoragePath };
    }
    if (campaign.headerImageAssetId) {
      const { getMediaAssetById } = await import("./media-asset-repositories");
      const asset = await getMediaAssetById(campaign.headerImageAssetId, scope);
      if (asset?.storagePath) return { storagePath: asset.storagePath };
    }
    return undefined;
  }

  const mapping = campaign.headerImageMapping;
  if (!mapping) {
    if (campaign.headerImageStoragePath) {
      return { storagePath: campaign.headerImageStoragePath };
    }
    return undefined;
  }

  if (mapping.startsWith("origin:")) {
    const key = mapping.slice("origin:".length);
    const raw = contact.originFields?.[key]?.trim();
    if (!raw) return undefined;
    if (raw.startsWith("companies/")) return { storagePath: raw };
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return { link: raw };
    }
    return { storagePath: raw };
  }

  if (mapping.startsWith("column:")) {
    const key = mapping.slice("column:".length);
    const raw = contact.customFields?.[key]?.trim();
    if (!raw) return undefined;
    if (raw.startsWith("companies/")) return { storagePath: raw };
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return { link: raw };
    }
    return { storagePath: raw };
  }

  if (mapping.startsWith("asset:")) {
    const assetId = mapping.slice("asset:".length);
    const { getMediaAssetById } = await import("./media-asset-repositories");
    const asset = await getMediaAssetById(assetId, scope);
    if (asset?.storagePath) return { storagePath: asset.storagePath };
    return undefined;
  }

  if (mapping.startsWith("storage:")) {
    return { storagePath: mapping.slice("storage:".length) };
  }

  if (campaign.headerImageStoragePath) {
    return { storagePath: campaign.headerImageStoragePath };
  }
  return undefined;
}

/** @deprecated use resolveHeaderImage */
export async function resolveHeaderImageStoragePath(
  contact: Contact,
  campaign: Pick<
    Campaign,
    | "headerImageMode"
    | "headerImageMapping"
    | "headerImageStoragePath"
    | "headerImageAssetId"
  >,
  scope: CompanyScope
): Promise<string | undefined> {
  const resolved = await resolveHeaderImage(contact, campaign, scope);
  return resolved?.storagePath;
}
