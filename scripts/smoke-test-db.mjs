// Smoke test da camada de dados MariaDB: exercita os fluxos reescritos
// diretamente pelos repositórios (sem HTTP/auth). Cria dados temporários
// numa empresa de teste e limpa ao final.
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env.production", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

const COMPANY = "__smoketest__";
const PHONE = "5522999990001";
let ok = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    ok++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  FALHA  ${label}`);
  }
}

try {
  // limpa resíduo de execuções anteriores
  await prisma.message.deleteMany({ where: { companyId: COMPANY } });
  await prisma.conversation.deleteMany({ where: { companyId: COMPANY } });
  await prisma.contact.deleteMany({ where: { companyId: COMPANY } });

  // 1. cria contato
  const contact = await prisma.contact.create({
    data: {
      name: "Fulano Teste",
      phone: PHONE,
      phoneNormalized: PHONE,
      source: "smoke",
      tags: ["lead"],
      optIn: true,
      companyId: COMPANY,
    },
  });
  check("contato criado", !!contact.id);

  // 2. busca por telefone (índice)
  const found = await prisma.contact.findFirst({
    where: { companyId: COMPANY, phoneNormalized: PHONE },
  });
  check("busca por telefone normalizado", found?.id === contact.id);

  // 3. cria conversa + mensagem inbound com increment de unread
  const conv = await prisma.conversation.create({
    data: {
      contactId: contact.id,
      phone: PHONE,
      phoneNormalized: PHONE,
      status: "open",
      lastMessageAt: new Date(),
      unreadCount: 0,
      companyId: COMPANY,
    },
  });
  await prisma.message.create({
    data: {
      conversationId: conv.id,
      contactId: contact.id,
      companyId: COMPANY,
      direction: "inbound",
      type: "text",
      body: "Olá, quero agendar",
      status: "received",
      rawPayload: { foo: "bar", nested: { n: 1 } },
    },
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { unreadCount: { increment: 1 }, lastInboundAt: new Date() },
  });
  const convAfter = await prisma.conversation.findUnique({ where: { id: conv.id } });
  check("increment de unreadCount", convAfter?.unreadCount === 1);

  // 4. JSON round-trip
  const msg = await prisma.message.findFirst({ where: { conversationId: conv.id } });
  check("JSON rawPayload preservado", msg?.rawPayload?.nested?.n === 1);

  // 5. listagem por empresa + join de contato
  const list = await prisma.conversation.findMany({
    where: { companyId: COMPANY },
    orderBy: { lastMessageAt: "desc" },
  });
  check("listagem de conversas", list.length === 1);

  // 6. dashboard: counts por direção
  const [sent, received] = await Promise.all([
    prisma.message.count({ where: { companyId: COMPANY, direction: "outbound" } }),
    prisma.message.count({ where: { companyId: COMPANY, direction: "inbound" } }),
  ]);
  check("dashboard counts (0 out / 1 in)", sent === 0 && received === 1);

  // 7. cascade: apagar conversa remove mensagens
  await prisma.conversation.delete({ where: { id: conv.id } });
  const orphan = await prisma.message.count({ where: { conversationId: conv.id } });
  check("cascade de mensagens ao apagar conversa", orphan === 0);

  // limpeza
  await prisma.contact.deleteMany({ where: { companyId: COMPANY } });
  console.log(`\nResultado: ${ok} ok, ${fail} falhas`);
} catch (err) {
  console.error("ERRO no smoke test:", err);
  fail++;
} finally {
  await prisma.$disconnect();
}

process.exit(fail === 0 ? 0 : 1);
