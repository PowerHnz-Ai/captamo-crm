// One-off: renomeia o label do campo `paciente_indicador` ("Paciente Indicador"
// → "Indicador") na origem `indicacoes` de TODAS as empresas já seedadas.
// A key não muda — só o texto exibido. Idempotente.
//   node scripts/rename-indicador-label.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
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

if (!process.env.DATABASE_URL) {
  console.error("[rename-indicador] DATABASE_URL não definido.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

const rows = await prisma.contactOrigin.findMany({ where: { key: "indicacoes" } });
console.log(`[rename-indicador] ${rows.length} origem(ns) "indicacoes" encontradas.`);

let changed = 0;
for (const row of rows) {
  const fields = Array.isArray(row.fields) ? row.fields : [];
  let touched = false;
  const next = fields.map((f) => {
    if (f && f.key === "paciente_indicador" && f.label !== "Indicador") {
      touched = true;
      return { ...f, label: "Indicador" };
    }
    return f;
  });
  if (!touched) continue;
  await prisma.contactOrigin.update({ where: { id: row.id }, data: { fields: next } });
  changed++;
  console.log(`  [ok] company=${row.companyId} origem=${row.id} label atualizado.`);
}

console.log(`[rename-indicador] concluído: ${changed} atualizadas, ${rows.length - changed} já corretas.`);
await prisma.$disconnect();
