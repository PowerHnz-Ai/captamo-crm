import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { CompanyScope } from "./firestore-repositories";
import type { MediaAsset, MediaAssetSource } from "./types";

function nowTimestamp() {
  return Timestamp.now();
}

export async function listMediaAssets(
  scope: CompanyScope,
  options?: { imagesOnly?: boolean; limit?: number }
): Promise<MediaAsset[]> {
  const snap = await getDb()
    .collection("media_assets")
    .where("companyId", "==", scope.companyId)
    .get();

  let assets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as MediaAsset);

  if (options?.imagesOnly) {
    assets = assets.filter((a) => a.mimeType.startsWith("image/"));
  }

  assets.sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  if (options?.limit) {
    assets = assets.slice(0, options.limit);
  }

  return assets;
}

export async function getMediaAssetById(
  id: string,
  scope: CompanyScope
): Promise<MediaAsset | null> {
  const doc = await getDb().collection("media_assets").doc(id).get();
  if (!doc.exists) return null;
  const asset = { id: doc.id, ...doc.data() } as MediaAsset;
  if (asset.companyId !== scope.companyId) return null;
  return asset;
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
  const ts = nowTimestamp();
  const ref = id
    ? getDb().collection("media_assets").doc(id)
    : getDb().collection("media_assets").doc();
  const asset: Omit<MediaAsset, "id"> = {
    ...data,
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...asset });
  return { id: ref.id, ...asset };
}
