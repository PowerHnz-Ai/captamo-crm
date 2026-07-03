import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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
const companyId = "3VEGUT";

const contactsSnap = await db
  .collection("contacts")
  .where("companyId", "==", companyId)
  .get();
console.log("contacts:", contactsSnap.size);

const ts = Timestamp.now();
const ref = db.collection("campaigns").doc();
const campaign = {
  id: ref.id,
  name: "test_script",
  templateName: "confirmacao_agendamento",
  templateLanguage: "pt_BR",
  status: "draft",
  contactListId: undefined,
  maxSendsPerRun: 1,
  parameterMapping: ["name"],
  totalContacts: contactsSnap.size,
  sentCount: 0,
  failedCount: 0,
  companyId,
  createdAt: ts,
  updatedAt: ts,
};

try {
  await ref.set(campaign);
  console.log("campaign created:", ref.id);

  if (contactsSnap.size > 0) {
    const batch = db.batch();
    const col = ref.collection("jobs");
    for (const doc of contactsSnap.docs) {
      const contact = doc.data();
      const jobRef = col.doc();
      batch.set(jobRef, {
        id: jobRef.id,
        contactId: doc.id,
        phone: contact.phone,
        contactName: contact.name,
        parameters: [contact.name],
        status: "pending",
        scheduledAt: ts,
        attempts: 0,
        createdAt: ts,
        updatedAt: ts,
      });
    }
    await batch.commit();
    console.log("jobs enqueued:", contactsSnap.size);
  }
} catch (error) {
  console.error("ERROR:", error);
  process.exit(1);
}

// cleanup
await ref.delete();
const jobs = await ref.collection("jobs").get();
const batch = db.batch();
jobs.docs.forEach((d) => batch.delete(d.ref));
await batch.commit();
console.log("cleanup done");
