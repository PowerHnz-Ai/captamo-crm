// Dedup de contatos por (company_id, phone_normalized) — pré-requisito para
// o índice UNIQUE. Sobrevive o contato mais antigo; tags/campos são mesclados
// e as referências (conversas, mensagens, deals, jobs, listas) reapontadas.
//
// Uso:
//   node scripts/dedup-contacts.mjs            # dry-run (só relata)
//   node scripts/dedup-contacts.mjs --apply    # aplica as mudanças
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
  console.error("[dedup] DATABASE_URL não definido.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

const asArray = (json) => (Array.isArray(json) ? json : []);
const asObject = (json) =>
  json && typeof json === "object" && !Array.isArray(json) ? json : {};

const groups = await prisma.$queryRaw`
  SELECT company_id AS companyId, phone_normalized AS phoneNormalized, COUNT(*) AS total
  FROM contacts
  GROUP BY company_id, phone_normalized
  HAVING COUNT(*) > 1
`;

console.log(
  `[dedup] ${groups.length} grupo(s) duplicado(s) encontrado(s).` +
    (apply ? " Aplicando..." : " (dry-run — use --apply para aplicar)")
);

// Telefones vazios/curtos merecem revisão manual antes do UNIQUE.
const suspicious = await prisma.contact.findMany({
  where: { OR: [{ phoneNormalized: "" }, { phoneNormalized: { in: ["0"] } }] },
  select: { id: true, companyId: true, name: true, phone: true },
});
if (suspicious.length > 0) {
  console.warn("[dedup] AVISO: contatos com telefone vazio/suspeito:");
  for (const c of suspicious) {
    console.warn(`  - ${c.companyId} ${c.id} "${c.name}" phone="${c.phone}"`);
  }
}

let mergedGroups = 0;
let removed = 0;

for (const group of groups) {
  const rows = await prisma.contact.findMany({
    where: {
      companyId: group.companyId,
      phoneNormalized: group.phoneNormalized,
    },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length < 2) continue;

  const survivor = rows[0];
  const dups = rows.slice(1);
  const dupIds = dups.map((d) => d.id);

  // Merge: tags = união; blocked = OR; optIn = AND (preserva opt-out);
  // customFields/originFields = merge raso (sobrevivente vence);
  // nome real vence nome igual ao telefone.
  const tagSet = new Set(asArray(survivor.tags));
  let blocked = survivor.blocked;
  let optIn = survivor.optIn;
  let name = survivor.name;
  let customFields = asObject(survivor.customFields);
  let originFields = asObject(survivor.originFields);
  let originId = survivor.originId;
  let leadClass = survivor.leadClass;
  for (const dup of dups) {
    for (const tag of asArray(dup.tags)) tagSet.add(tag);
    blocked = blocked || dup.blocked;
    optIn = optIn && dup.optIn;
    if (name === survivor.phoneNormalized && dup.name !== dup.phoneNormalized) {
      name = dup.name;
    }
    customFields = { ...asObject(dup.customFields), ...customFields };
    originFields = { ...asObject(dup.originFields), ...originFields };
    originId = originId ?? dup.originId;
    leadClass = leadClass ?? dup.leadClass;
  }

  console.log(
    `[dedup] ${group.companyId} ${group.phoneNormalized}: mantém ${survivor.id} ` +
      `("${survivor.name}"), remove ${dupIds.join(", ")}`
  );

  if (!apply) {
    mergedGroups++;
    removed += dupIds.length;
    continue;
  }

  await prisma.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: survivor.id },
      data: {
        name,
        tags: [...tagSet],
        blocked,
        optIn,
        customFields,
        originFields,
        originId,
        leadClass,
      },
    });
    await tx.conversation.updateMany({
      where: { contactId: { in: dupIds } },
      data: { contactId: survivor.id },
    });
    await tx.message.updateMany({
      where: { contactId: { in: dupIds } },
      data: { contactId: survivor.id },
    });
    await tx.deal.updateMany({
      where: { contactId: { in: dupIds } },
      data: { contactId: survivor.id },
    });
    await tx.campaignJob.updateMany({
      where: { contactId: { in: dupIds } },
      data: { contactId: survivor.id },
    });

    const lists = await tx.contactList.findMany({
      where: { companyId: group.companyId },
    });
    for (const list of lists) {
      const ids = asArray(list.contactIds);
      if (!ids.some((id) => dupIds.includes(id))) continue;
      const next = [
        ...new Set(ids.map((id) => (dupIds.includes(id) ? survivor.id : id))),
      ];
      await tx.contactList.update({
        where: { id: list.id },
        data: { contactIds: next },
      });
    }

    await tx.contact.deleteMany({ where: { id: { in: dupIds } } });
  });

  mergedGroups++;
  removed += dupIds.length;
}

console.log(
  `[dedup] ${apply ? "Aplicado" : "Dry-run"}: ${mergedGroups} grupo(s), ` +
    `${removed} contato(s) duplicado(s) ${apply ? "removidos" : "a remover"}.`
);

await prisma.$disconnect();
