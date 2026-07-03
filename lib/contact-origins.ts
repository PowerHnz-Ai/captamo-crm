import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { CompanyScope } from "./firestore-repositories";

export type ContactOriginFieldType = "month" | "text" | "phone" | "contact_ref";

export interface ContactOriginField {
  key: string;
  label: string;
  type: ContactOriginFieldType;
  required?: boolean;
}

export interface ContactOrigin {
  id: string;
  companyId: string;
  key: string;
  label: string;
  isSystem: boolean;
  fields: ContactOriginField[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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

function nowTimestamp() {
  return Timestamp.now();
}

export async function seedContactOriginsForCompany(
  scope: CompanyScope
): Promise<ContactOrigin[]> {
  const snap = await getDb()
    .collection("contact_origins")
    .where("companyId", "==", scope.companyId)
    .get();

  if (!snap.empty) {
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ContactOrigin);
  }

  const created: ContactOrigin[] = [];
  const ts = nowTimestamp();

  for (const origin of SYSTEM_ORIGINS) {
    const ref = getDb().collection("contact_origins").doc();
    const record: Omit<ContactOrigin, "id"> = {
      ...origin,
      companyId: scope.companyId,
      createdAt: ts,
      updatedAt: ts,
    };
    await ref.set({ id: ref.id, ...record });
    created.push({ id: ref.id, ...record });
  }

  return created;
}

export async function listContactOrigins(scope: CompanyScope): Promise<ContactOrigin[]> {
  const snap = await getDb()
    .collection("contact_origins")
    .where("companyId", "==", scope.companyId)
    .get();

  if (snap.empty) {
    return seedContactOriginsForCompany(scope);
  }

  const origins = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ContactOrigin);
  origins.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return origins;
}

export async function getContactOriginById(
  id: string,
  scope: CompanyScope
): Promise<ContactOrigin | null> {
  const doc = await getDb().collection("contact_origins").doc(id).get();
  if (!doc.exists) return null;
  const origin = { id: doc.id, ...doc.data() } as ContactOrigin;
  if (origin.companyId !== scope.companyId) return null;
  return origin;
}

export async function createCustomContactOrigin(
  data: { label: string; fields: ContactOriginField[] },
  scope: CompanyScope
): Promise<ContactOrigin> {
  const ts = nowTimestamp();
  const key = `custom_${Date.now()}`;
  const ref = getDb().collection("contact_origins").doc();
  const origin: Omit<ContactOrigin, "id"> = {
    key,
    label: data.label,
    isSystem: false,
    fields: data.fields,
    companyId: scope.companyId,
    createdAt: ts,
    updatedAt: ts,
  };
  await ref.set({ id: ref.id, ...origin });
  return { id: ref.id, ...origin };
}

export async function updateContactOrigin(
  id: string,
  data: Partial<Pick<ContactOrigin, "label" | "fields">>,
  scope: CompanyScope
): Promise<ContactOrigin | null> {
  const existing = await getContactOriginById(id, scope);
  if (!existing) return null;
  if (existing.isSystem && data.fields) {
    const updated = { ...existing, fields: data.fields, updatedAt: nowTimestamp() };
    if (existing.key !== "custom") {
      await getDb().collection("contact_origins").doc(id).update({
        fields: data.fields,
        updatedAt: nowTimestamp(),
      });
      return updated;
    }
  }

  const update: Record<string, unknown> = { updatedAt: nowTimestamp() };
  if (data.label) update.label = data.label;
  if (data.fields) update.fields = data.fields;

  await getDb().collection("contact_origins").doc(id).update(update);
  return { ...existing, ...data, updatedAt: nowTimestamp() } as ContactOrigin;
}
