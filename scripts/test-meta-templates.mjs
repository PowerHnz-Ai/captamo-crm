import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);

const waba = env.META_WABA_ID;
const token = env.META_WHATSAPP_TOKEN;
const ver = env.META_GRAPH_API_VERSION || "v25.0";

const res = await fetch(
  `https://graph.facebook.com/${ver}/${waba}/message_templates?limit=20`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await res.json();

if (data.error) {
  console.log("META_ERROR:", data.error.message, "code:", data.error.code);
  process.exit(1);
}

const items = data.data || [];
console.log("COUNT:", items.length);
for (const t of items) {
  console.log("-", t.name, t.language, t.status);
}
