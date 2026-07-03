import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

const APP_NAME = "mister-hub-crm";

export function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  return key.replace(/\\n/g, "\n");
}

function createFirebaseApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY."
    );
  }

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY inválida. Use o formato com \\n entre aspas no .env.local"
    );
  }

  return initializeApp(
    {
      projectId,
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    },
    APP_NAME
  );
}

function getFirebaseApp(): App {
  try {
    return getApp(APP_NAME);
  } catch {
    const existing = getApps().find((app) => app.name === APP_NAME);
    if (existing) return existing;
    return createFirebaseApp();
  }
}

let firestoreInstance: Firestore | null = null;

export function getDb(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getFirebaseApp());
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  }
  return firestoreInstance;
}

export function getAdminProjectId(): string {
  return getFirebaseApp().options.projectId || process.env.FIREBASE_PROJECT_ID || "";
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseApp());
}

let storageInstance: Storage | null = null;

export function getAdminStorage(): Storage {
  if (!storageInstance) {
    storageInstance = getStorage(getFirebaseApp());
  }
  return storageInstance;
}

export function getStorageBucketName(): string {
  const explicit =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (explicit) return explicit;
  const projectId = getAdminProjectId();
  return projectId ? `${projectId}.appspot.com` : "";
}
