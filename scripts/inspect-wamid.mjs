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
const msg = await db
  .collection("conversations")
  .doc("3PulLXl3rnbpA6YNdO4j")
  .collection("messages")
  .where("whatsappMessageId", "==", "wamid.HBgNNTUyMjk5OTgzNjk2NRUCABEYEjUxMUI2RDIyRkQzOEQ4QzlFQgA=")
  .get();

for (const d of msg.docs) {
  console.log(JSON.stringify(d.data(), null, 2));
}

// decode wamid phone hint
const wamid = "wamid.HBgNNTUyMjk5OTgzNjk2NRUCABEYEjUxMUI2RDIyRkQzOEQ4QzlFQgA=";
const part = wamid.split(".")[1]?.slice(2);
if (part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  try {
    console.log("\nDecoded wa_id from wamid:", Buffer.from(padded.slice(0, 16), "base64").toString());
  } catch {}
}

const ver = env.META_GRAPH_API_VERSION || "v25.0";
const phoneNumberId = env.META_PHONE_NUMBER_ID;
const token = env.META_WHATSAPP_TOKEN;

// Check if recipient number is on WhatsApp via contacts API isn't available easily
// Try to read message template analytics - not available per message

// Compare phone variants
const stored = "552299836965";
const withNine = "5522999836965";
console.log("\nStored contact:", stored);
console.log("Meta wamid target (likely):", withNine);
