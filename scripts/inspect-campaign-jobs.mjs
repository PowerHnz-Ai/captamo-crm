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
const campaigns = await db.collection("campaigns").get();

for (const camp of campaigns.docs) {
  const c = camp.data();
  console.log("\n===", c.name, camp.id, c.status, `sent=${c.sentCount} failed=${c.failedCount}`);

  const jobs = await camp.ref.collection("jobs").get();
  for (const job of jobs.docs) {
    const j = job.data();
    console.log(" job", job.id, j.status, j.phone, j.contactName);
    console.log("  parameters:", j.parameters);
    if (j.lastError) console.log("  lastError:", j.lastError);
  }
}
