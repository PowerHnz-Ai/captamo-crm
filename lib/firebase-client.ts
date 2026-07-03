"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { firebasePublicConfig, isFirebaseClientConfigured } from "./firebase-config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!isFirebaseClientConfigured()) {
    throw new Error("Firebase client não configurado. Defina NEXT_PUBLIC_FIREBASE_* no .env.local");
  }

  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebasePublicConfig);
  }

  if (!auth) {
    auth = getAuth(app);
  }

  return auth;
}
