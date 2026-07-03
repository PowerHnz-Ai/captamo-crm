import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    val = val.slice(1, -1).replace(/\\n/g, "\n");
  }
  process.env[key] = val;
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

const db = getFirestore();
const auth = getAuth();
let pageToken;
let missing = 0;
let ok = 0;

do {
  const result = await auth.listUsers(1000, pageToken);
  for (const u of result.users) {
    const profile = await db.collection("users").doc(u.uid).get();
    if (!profile.exists || !profile.data()?.companyId) {
      missing++;
      console.log(`MISSING: ${u.email} uid=${u.uid}`);
    } else {
      ok++;
    }
  }
  pageToken = result.pageToken;
} while (pageToken);

console.log(`\nTotal OK: ${ok}, missing profile/companyId: ${missing}`);
