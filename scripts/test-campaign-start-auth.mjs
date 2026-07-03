import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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

const uid = "Reqm742SySXgbFC3YiQqsr2ZDev2"; // powerheinzf@gmail.com @ 3VEGUT
const campaignId = "TuXHdBSprsW8ZnGl7n6X";
const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const port = process.argv[2] || "3001";

const customToken = await getAuth().createCustomToken(uid);
const signInRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  }
);
const signInData = await signInRes.json();
if (!signInData.idToken) {
  console.error("signIn failed", signInData);
  process.exit(1);
}

const idToken = signInData.idToken;
console.log("got idToken for uid", uid);

for (const path of ["/api/campaigns", `/api/campaigns/${campaignId}`]) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method: path.includes("[") ? "GET" : path.endsWith(campaignId) ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body:
      path.endsWith(campaignId)
        ? JSON.stringify({ action: "start" })
        : undefined,
  });
  const text = await res.text();
  console.log("\n", path, "HTTP", res.status, text.slice(0, 500));
}

// fix method logic
const getRes = await fetch(`http://localhost:${port}/api/campaigns`, {
  headers: { Authorization: `Bearer ${idToken}` },
});
console.log("\nGET /api/campaigns", getRes.status, (await getRes.text()).slice(0, 200));

const postRes = await fetch(`http://localhost:${port}/api/campaigns/${campaignId}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action: "start" }),
});
const postText = await postRes.text();
console.log("\nPOST start", postRes.status, postText.slice(0, 500));
