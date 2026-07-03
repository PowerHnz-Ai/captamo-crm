import { randomUUID } from "crypto";
import { getAdminStorage, getStorageBucketName } from "./firebase-admin";

const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

export const MEDIA_SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

export const ALLOWED_MIME_PREFIXES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "text/plain",
];

export function isAllowedMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return ALLOWED_MIME_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      (prefix.endsWith("/") && normalized.startsWith(prefix))
  );
}

export function mediaKindFromMime(mimeType: string): "image" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export function maxBytesForMime(mimeType: string): number {
  return MEDIA_SIZE_LIMITS[mediaKindFromMime(mimeType)] ?? MEDIA_SIZE_LIMITS.document;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export function buildChatMediaPath(params: {
  companyId: string;
  conversationId: string;
  messageId?: string;
  filename: string;
}): string {
  const segment = params.messageId || randomUUID();
  return `companies/${params.companyId}/chat/${params.conversationId}/${segment}/${sanitizeFilename(params.filename)}`;
}

export function buildMediaLibraryPath(params: {
  companyId: string;
  assetId: string;
  filename: string;
}): string {
  return `companies/${params.companyId}/media-library/${params.assetId}/${sanitizeFilename(params.filename)}`;
}

export function buildUserAvatarPath(params: {
  companyId: string;
  uid: string;
  filename: string;
}): string {
  return `companies/${params.companyId}/avatars/${params.uid}/${sanitizeFilename(params.filename)}`;
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export function isAllowedAvatarMimeType(mimeType: string): boolean {
  return AVATAR_ALLOWED_MIME.includes(
    mimeType.toLowerCase() as (typeof AVATAR_ALLOWED_MIME)[number]
  );
}

export function avatarFilenameFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("png")) return "avatar.png";
  if (normalized.includes("webp")) return "avatar.webp";
  return "avatar.jpg";
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

export function assertCompanyMediaPath(storagePath: string, companyId: string): void {
  const expected = `companies/${companyId}/`;
  if (!storagePath.startsWith(expected)) {
    throw new Error("Caminho de mídia inválido para esta empresa.");
  }
}

export async function uploadCompanyMedia(params: {
  companyId: string;
  conversationId: string;
  messageId?: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<{ storagePath: string; signedUrl?: string }> {
  const storagePath = buildChatMediaPath(params);
  const bucket = getAdminStorage().bucket(getStorageBucketName());
  const file = bucket.file(storagePath);

  await file.save(params.buffer, {
    metadata: {
      contentType: params.mimeType,
      metadata: {
        companyId: params.companyId,
        conversationId: params.conversationId,
      },
    },
  });

  let signedUrl: string | undefined;
  try {
    [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
  } catch (error) {
    console.warn("[media-storage] Signed URL indisponível (mídia salva):", error);
  }

  return { storagePath, signedUrl };
}

export async function uploadUserAvatar(params: {
  companyId: string;
  uid: string;
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<{ storagePath: string }> {
  const storagePath = buildUserAvatarPath({
    companyId: params.companyId,
    uid: params.uid,
    filename: params.filename || avatarFilenameFromMime(params.mimeType),
  });
  const bucket = getAdminStorage().bucket(getStorageBucketName());
  const file = bucket.file(storagePath);

  await file.save(params.buffer, {
    metadata: {
      contentType: params.mimeType,
      metadata: {
        companyId: params.companyId,
        uid: params.uid,
      },
    },
  });

  return { storagePath };
}

export async function uploadMediaLibraryAsset(params: {
  companyId: string;
  assetId: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<{ storagePath: string; signedUrl?: string }> {
  const storagePath = buildMediaLibraryPath({
    companyId: params.companyId,
    assetId: params.assetId,
    filename: params.filename,
  });
  const bucket = getAdminStorage().bucket(getStorageBucketName());
  const file = bucket.file(storagePath);

  await file.save(params.buffer, {
    metadata: {
      contentType: params.mimeType,
      metadata: {
        companyId: params.companyId,
        assetId: params.assetId,
      },
    },
  });

  let signedUrl: string | undefined;
  try {
    [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
  } catch (error) {
    console.warn("[media-storage] Signed URL indisponível (biblioteca):", error);
  }

  return { storagePath, signedUrl };
}

export async function getMediaSignedUrl(
  storagePath: string,
  expiresMs = SIGNED_URL_TTL_MS
): Promise<string> {
  const bucket = getAdminStorage().bucket(getStorageBucketName());
  const file = bucket.file(storagePath);
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresMs,
  });
  return signedUrl;
}

export async function downloadStorageMedia(
  storagePath: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const bucket = getAdminStorage().bucket(getStorageBucketName());
  const file = bucket.file(storagePath);
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  return {
    buffer: Buffer.from(buffer),
    mimeType: metadata.contentType || "application/octet-stream",
  };
}

export async function downloadRemoteMedia(
  url: string,
  headers?: Record<string, string>
): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Falha ao baixar mídia (${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}
