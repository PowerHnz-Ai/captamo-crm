// QA: impersonação do platform admin (header x-platform-company-id).
// Uso: node scripts/test-impersonation.mjs <companyId> [baseUrl|porta] [uidUsuarioComum]
//   - companyId: código de uma empresa existente para impersonar
//   - baseUrl: http://localhost:3001 (padrão) ou https://dominio
//   - uidUsuarioComum: se informado, testa que o header é IGNORADO para não-admins
import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const IMPERSONATION_HEADER = "x-platform-company-id";
const ADMIN_EMAIL = "adminultrahub@gmail.com";

function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1);
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        return [l.slice(0, i), v.replace(/\\n/g, "\n")];
      })
  );
}
const env = loadEnv();

const companyId = process.argv[2];
if (!companyId) {
  console.error("uso: node scripts/test-impersonation.mjs <companyId> [baseUrl|porta] [uidComum]");
  process.exit(1);
}
const baseArg = process.argv[3] || "3001";
const base = baseArg.startsWith("http") ? baseArg : `http://localhost:${baseArg}`;
const regularUid = process.argv[4];

const results = [];
const ok = (name, pass, detail = "") =>
  results.push(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

async function tokenFor(uid) {
  const custom = await getAuth().createCustomToken(uid);
  const data = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  ).then((r) => r.json());
  if (!data.idToken) throw new Error(`signIn falhou: ${JSON.stringify(data.error)}`);
  return data.idToken;
}

const adminUser = await getAuth().getUserByEmail(ADMIN_EMAIL);
const adminToken = await tokenFor(adminUser.uid);
const authHeaders = { Authorization: `Bearer ${adminToken}` };

// 1) /api/auth/me → 200 platformAdmin true
{
  const res = await fetch(`${base}/api/auth/me`, { headers: authHeaders });
  const data = await res.json();
  ok(
    "auth/me → 200 platformAdmin",
    res.ok && data.platformAdmin === true,
    `status=${res.status} companyId="${data.companyId ?? ""}"`
  );

  // 2) rota scoped SEM header: só falha 401 se o admin não tem companyId legado
  const scoped = await fetch(`${base}/api/dashboard/stats`, { headers: authHeaders });
  if (data.companyId) {
    ok("scoped sem header (companyId legado) → 200", scoped.ok, `status=${scoped.status}`);
  } else {
    ok("scoped sem header (sem empresa) → 401", scoped.status === 401, `status=${scoped.status}`);
  }
}

// 3) rota scoped COM header → 200 (dados da clínica impersonada)
{
  const res = await fetch(`${base}/api/dashboard/stats`, {
    headers: { ...authHeaders, [IMPERSONATION_HEADER]: companyId },
  });
  const data = await res.json();
  ok(
    "scoped com header → 200",
    res.ok && typeof data.stats?.totalContacts === "number",
    `status=${res.status} contatos=${data.stats?.totalContacts}`
  );
}

// 4) equipe da clínica impersonada acessível (fluxo "criar gerente")
{
  const res = await fetch(`${base}/api/team`, {
    headers: { ...authHeaders, [IMPERSONATION_HEADER]: companyId },
  });
  ok("GET /api/team impersonado → 200", res.ok, `status=${res.status}`);
}

// 5) /api/platform/clients → 200 com userCount/whatsappConfigured
{
  const res = await fetch(`${base}/api/platform/clients`, { headers: authHeaders });
  const data = await res.json();
  const first = data.companies?.[0];
  ok(
    "platform/clients com campos novos",
    res.ok &&
      Array.isArray(data.companies) &&
      (!first ||
        (typeof first.userCount === "number" &&
          typeof first.whatsappConfigured === "boolean")),
    `status=${res.status} empresas=${data.companies?.length}`
  );
}

// 6) usuário comum com header → header IGNORADO (dados da própria empresa)
if (regularUid) {
  const regularToken = await tokenFor(regularUid);
  const me = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${regularToken}` },
  }).then((r) => r.json());
  const res = await fetch(`${base}/api/team`, {
    headers: {
      Authorization: `Bearer ${regularToken}`,
      [IMPERSONATION_HEADER]: companyId,
    },
  });
  const data = await res.json();
  const foreign = me.companyId && me.companyId !== companyId;
  const members = data.members || data.team || [];
  const leaked = foreign
    ? members.some?.((m) => m.companyId && m.companyId === companyId)
    : false;
  ok(
    "não-admin com header → ignorado",
    res.status !== 403 && !leaked,
    `status=${res.status} empresaPropria=${me.companyId}`
  );
} else {
  results.push("SKIP não-admin com header (uid não informado)");
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(failed === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${failed} TESTE(S) FALHARAM`);
process.exit(failed === 0 ? 0 : 1);
