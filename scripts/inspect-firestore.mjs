import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1);
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        return [l.slice(0, i), v.replace(/\\n/g, "\n")];
      })
  );
}

const env = loadEnv();
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

const db = getFirestore();
const snap = await db.collection("contacts").get();
console.log("total contacts", snap.size);
for (const d of snap.docs) {
  const x = d.data();
  console.log("-", d.id, x.name, x.companyId);
}

const users = await db.collection("users").get();
for (const d of users.docs) {
  console.log("user", d.id, d.data().email, d.data().companyId);
}

const camps = await db.collection("campaigns").get();
console.log("campaigns", camps.size);
for (const d of camps.docs) {
  const x = d.data();
  console.log("- campaign", d.id, x.name, x.companyId, x.status);
}
