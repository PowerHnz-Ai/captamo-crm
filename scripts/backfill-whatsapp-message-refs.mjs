/**
 * Preenche whatsapp_message_refs para mensagens antigas (sem índice collection group).
 * Uso na VPS: node scripts/backfill-whatsapp-message-refs.mjs
 */
import { readFileSync, existsSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function loadEnv() {
  const path = existsSync(".env.production") ? ".env.production" : ".env.local";
  return Object.fromEntries(
    readFileSync(path, "utf8")
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
let written = 0;
let scanned = 0;

const conversations = await db.collection("conversations").get();
for (const conv of conversations.docs) {
  const companyId = conv.data().companyId;
  if (!companyId) continue;

  const messages = await conv.ref.collection("messages").get();
  for (const msg of messages.docs) {
    scanned++;
    const wamid = msg.data().whatsappMessageId;
    if (!wamid) continue;

    const ref = db.collection("whatsapp_message_refs").doc(wamid);
    const existing = await ref.get();
    if (existing.exists) continue;

    await ref.set({
      companyId,
      conversationId: conv.id,
      messageId: msg.id,
      updatedAt: Timestamp.now(),
    });
    written++;
  }
}

console.log(`Concluído. Mensagens verificadas: ${scanned}. Refs criadas: ${written}.`);
