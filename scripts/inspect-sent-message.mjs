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
const campaignId = "1KXaq2FeQ13fSnjuGm6o";

const jobs = await db.collection("campaigns").doc(campaignId).collection("jobs").get();
for (const job of jobs.docs) {
  console.log("JOB", JSON.stringify(job.data(), null, 2));
}

const messages = await db.collectionGroup("messages")
  .where("body", ">=", "Template:")
  .limit(5)
  .get()
  .catch(async () => {
    const convs = await db.collection("conversations").get();
    for (const c of convs.docs) {
      const msgs = await c.ref.collection("messages").orderBy("createdAt", "desc").limit(3).get();
      for (const m of msgs.docs) console.log("MSG", m.data());
    }
    return { docs: [] };
  });

for (const m of messages.docs) {
  console.log("MSG", JSON.stringify(m.data(), null, 2));
}

const contact = await db.collection("contacts").doc("sl3tIPm4aXdimJarPGc0").get();
console.log("CONTACT", contact.data());
