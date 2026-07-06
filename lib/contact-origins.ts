import { Prisma } from "@prisma/client";
import { getSql } from "./db";
import { contactOriginFromRow } from "./db-mappers";
import type { CompanyScope } from "./firestore-repositories";
import type { ContactOrigin, ContactOriginField, ContactOriginFieldType } from "./types";

export type { ContactOrigin, ContactOriginField, ContactOriginFieldType };

const SYSTEM_ORIGINS: Array<
  Pick<ContactOrigin, "key" | "label" | "isSystem" | "fields">
> = [
  {
    key: "meta",
    label: "Meta",
    isSystem: true,
    fields: [{ key: "mes_entrada", label: "Mês de Entrada", type: "month", required: true }],
  },
  {
    key: "indicacoes",
    label: "Indicações",
    isSystem: true,
    fields: [
      { key: "mes_indicacao", label: "Mês da indicação", type: "month", required: true },
      { key: "paciente_indicador", label: "Paciente Indicador", type: "contact_ref", required: true },
    ],
  },
  {
    key: "eventos",
    label: "Eventos",
    isSystem: true,
    fields: [
      { key: "mes_evento", label: "Mês do Evento", type: "month", required: true },
      { key: "nome_evento", label: "Nome do Evento", type: "text", required: true },
    ],
  },
  {
    key: "google",
    label: "Google",
    isSystem: true,
    fields: [{ key: "mes_entrada", label: "Mês de Entrada", type: "month", required: true }],
  },
  {
    key: "custom",
    label: "Personalizado",
    isSystem: true,
    fields: [],
  },
];

export async function seedContactOriginsForCompany(
  scope: CompanyScope
): Promise<ContactOrigin[]> {
  const sql = getSql();
  const existing = await sql.contactOrigin.findMany({
    where: { companyId: scope.companyId },
  });
  if (existing.length > 0) {
    return existing.map(contactOriginFromRow);
  }

  const created: ContactOrigin[] = [];
  for (const origin of SYSTEM_ORIGINS) {
    const row = await sql.contactOrigin.create({
      data: {
        key: origin.key,
        label: origin.label,
        isSystem: origin.isSystem,
        fields: origin.fields as unknown as Prisma.InputJsonValue,
        companyId: scope.companyId,
      },
    });
    created.push(contactOriginFromRow(row));
  }

  return created;
}

export async function listContactOrigins(scope: CompanyScope): Promise<ContactOrigin[]> {
  const rows = await getSql().contactOrigin.findMany({
    where: { companyId: scope.companyId },
  });

  if (rows.length === 0) {
    return seedContactOriginsForCompany(scope);
  }

  const origins = rows.map(contactOriginFromRow);
  origins.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return origins;
}

export async function getContactOriginById(
  id: string,
  scope: CompanyScope
): Promise<ContactOrigin | null> {
  const row = await getSql().contactOrigin.findFirst({
    where: { id, companyId: scope.companyId },
  });
  return row ? contactOriginFromRow(row) : null;
}

export async function createCustomContactOrigin(
  data: { label: string; fields: ContactOriginField[] },
  scope: CompanyScope
): Promise<ContactOrigin> {
  const key = `custom_${Date.now()}`;
  const row = await getSql().contactOrigin.create({
    data: {
      key,
      label: data.label,
      isSystem: false,
      fields: data.fields as unknown as Prisma.InputJsonValue,
      companyId: scope.companyId,
    },
  });
  return contactOriginFromRow(row);
}

export async function updateContactOrigin(
  id: string,
  data: Partial<Pick<ContactOrigin, "label" | "fields">>,
  scope: CompanyScope
): Promise<ContactOrigin | null> {
  const existing = await getContactOriginById(id, scope);
  if (!existing) return null;

  // Origens de sistema (exceto "custom") aceitam apenas alteração de campos.
  const allowLabel = !existing.isSystem || existing.key === "custom";

  const row = await getSql().contactOrigin.update({
    where: { id },
    data: {
      ...(data.label && allowLabel ? { label: data.label } : {}),
      ...(data.fields
        ? { fields: data.fields as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
  return contactOriginFromRow(row);
}
