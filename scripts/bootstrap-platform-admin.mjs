// Bootstrap do platform admin em um projeto Firebase novo (ovo-e-galinha do
// primeiro login): cria/atualiza a conta adminultrahub@gmail.com e o doc
// users/{uid}, e valida o login com a senha informada.
//
// Uso:
//   node scripts/bootstrap-platform-admin.mjs <senha> [companyId]
//
// - 1ª execução (sem empresa ainda): omita o companyId — usa o placeholder
//   "BOOT". Faça login, cadastre a primeira empresa na tela Clientes e rode
//   de novo com o código gerado para corrigir o doc.
// - Execuções seguintes: passa o companyId real; a senha é redefinida para a
//   informada e o doc é atualizado.
//
// Lê as credenciais Firebase de .env.production (VPS) ou .env.local (dev).
import { readFileSync, existsSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const EMAIL = "adminultrahub@gmail.com";

function loadEnv() {
  const file = [".env.production", ".env.local"].find((f) => existsSync(f));
  if (!file) {
    console.error("ERRO: nenhum .env.production ou .env.local encontrado no diretório atual.");
    process.exit(1);
  }
  console.log(`usando variáveis de ${file}`);
  return Object.fromEntries(
    readFileSync(file, "utf8")
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

const PASSWORD = process.argv[2];
const COMPANY_ID = process.argv[3] || "BOOT";
if (!PASSWORD || PASSWORD.length < 8) {
  console.error("uso: node scripts/bootstrap-platform-admin.mjs <senha (mín. 8)> [companyId]");
  process.exit(1);
}

const env = loadEnv();
for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY"]) {
  if (!env[key]) {
    console.error(`ERRO: variável ${key} ausente no arquivo de env.`);
    process.exit(1);
  }
}
console.log(`projeto Firebase: ${env.FIREBASE_PROJECT_ID}`);

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

let user;
try {
  user = await getAuth().getUserByEmail(EMAIL);
  console.log("usuário já existia:", user.uid, "— redefinindo a senha.");
  await getAuth().updateUser(user.uid, { password: PASSWORD });
} catch {
  user = await getAuth().createUser({
    email: EMAIL,
    password: PASSWORD,
    displayName: "Ultra Hub Admin",
    emailVerified: true,
  });
  console.log("usuário criado:", user.uid);
}

const db = getFirestore();
await db.doc(`users/${user.uid}`).set(
  {
    name: "Ultra Hub Admin",
    email: EMAIL,
    companyId: COMPANY_ID,
    role: "admin",
    active: true,
    createdAt: new Date(),
  },
  { merge: true }
);
console.log(`doc users/${user.uid} gravado (companyId: ${COMPANY_ID})`);
if (COMPANY_ID === "BOOT") {
  console.log(
    "LEMBRETE: após cadastrar a primeira empresa, rode de novo com o código dela como 2º argumento."
  );
}

// Valida o login com a senha informada.
const signIn = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  }
).then((r) => r.json());
console.log(
  signIn.idToken
    ? "PASS: login com a senha funciona"
    : `FAIL: login falhou — ${JSON.stringify(signIn.error)}`
);
process.exit(signIn.idToken ? 0 : 1);
