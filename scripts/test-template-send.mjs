import { readFileSync } from "fs";

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
const ver = env.META_GRAPH_API_VERSION || "v25.0";
const phoneNumberId = env.META_PHONE_NUMBER_ID;
const token = env.META_WHATSAPP_TOKEN;
const to = "552299836965";

async function send(parameters) {
  const res = await fetch(`https://graph.facebook.com/${ver}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: "confirmacao_agendamento",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: parameters.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
  });
  const data = await res.json();
  console.log("\nparams:", parameters);
  console.log("status:", res.status);
  console.log(JSON.stringify(data, null, 2));
}

await send(["Power"]);
await send(["Power", "24/06/2026", "15:00"]);
