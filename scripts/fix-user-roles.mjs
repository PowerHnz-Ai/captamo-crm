// Diagnostica (e corrige com --fix) papéis inválidos nos docs `users` do
// Firestore. Um role/cargo fora dos tokens canônicos (admin|gerente|leader|
// member) faz o usuário cair silenciosamente em "member" (Atendente) — sem
// permissões e com inbox escopado. Uso:
//   node scripts/fix-user-roles.mjs          # dry-run (só lista)
//   node scripts/fix-user-roles.mjs --fix    # grava o role canônico
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.production", ".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function normalizePrivateKey(raw) {
  if (!raw) return undefined;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
if (!projectId || !clientEmail || !privateKey) {
  console.error("[fix-roles] Credenciais Firebase Admin ausentes no .env.");
  process.exit(1);
}

const app = initializeApp({
  projectId,
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

// Mesma lógica tolerante de lib/roles.ts (mantida em sincronia manualmente).
const CANONICAL = new Set(["admin", "gerente", "leader", "member"]);
function normalizeSingleRole(raw) {
  const value = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (value === "admin" || value === "administrador") return "admin";
  if (value === "gerente" || value === "lider") return "gerente";
  if (value === "leader" || value === "supervisor") return "leader";
  if (value === "atendimento" || value === "atendente") return "member";
  if (value === "member" || value === "colaborador") return "member";
  return null;
}

const FIX = process.argv.includes("--fix");
const snap = await db.collection("users").get();
console.log(`[fix-roles] ${snap.size} usuários no total. Modo: ${FIX ? "FIX" : "dry-run"}`);

let problems = 0;
let fixed = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  const rawRole = data.role;
  const rawCargo = data.cargo;

  // Já canônico? nada a fazer.
  if (typeof rawRole === "string" && CANONICAL.has(rawRole)) continue;

  const fromRole = rawRole != null ? normalizeSingleRole(rawRole) : null;
  const fromCargo = rawCargo != null ? normalizeSingleRole(rawCargo) : null;
  const resolved = fromRole || fromCargo;

  problems++;
  const label = `${doc.id} | company=${data.companyId ?? "?"} | email=${data.email ?? "?"}`;
  console.log(
    `  [problema] ${label}\n             role bruto=${JSON.stringify(rawRole)} cargo bruto=${JSON.stringify(rawCargo)} → resolve para: ${resolved ?? "member (fallback!)"}`
  );

  if (FIX && resolved) {
    await doc.ref.update({
      role: resolved,
      cargo: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    });
    fixed++;
    console.log(`             [corrigido] role="${resolved}" gravado.`);
  } else if (FIX && !resolved) {
    console.log(
      `             [NÃO corrigido] valor irreconhecível — decida manualmente (updateUserRole).`
    );
  }
}

console.log(
  `[fix-roles] concluído: ${problems} com papel não-canônico${FIX ? `, ${fixed} corrigidos` : ""}.`
);
if (!FIX && problems > 0) {
  console.log("[fix-roles] rode com --fix para gravar os papéis resolvidos.");
}
process.exit(0);
