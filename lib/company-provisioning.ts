import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getDb } from "./firebase-admin";
import type { UserRole } from "./types";

const COMPANY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Gera um código de empresa de 6 chars (mesma tabela do Task Checklist). */
function generateCompanyCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += COMPANY_CODE_CHARS.charAt(
      Math.floor(Math.random() * COMPANY_CODE_CHARS.length)
    );
  }
  return code;
}

export class ProvisioningError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Cria a conta Firebase Auth com senha aleatória (definida depois via e-mail). */
async function createAuthAccount(email: string, displayName: string): Promise<string> {
  const randomPassword =
    "Ult#" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  try {
    const record = await getAdminAuth().createUser({
      email,
      displayName,
      password: randomPassword,
    });
    return record.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      throw new ProvisioningError("Já existe uma conta com este e-mail.", 409);
    }
    if (code === "auth/invalid-email") {
      throw new ProvisioningError("E-mail inválido.", 400);
    }
    throw error;
  }
}

export interface CreateClientResult {
  companyId: string;
  managerUid: string;
  managerEmail: string;
}

/**
 * Cadastra um cliente novo: cria a empresa (doc companies/{code}, compatível
 * com o checklist) e o primeiro gerente. Retorna dados para o cliente disparar
 * o e-mail de definição de senha.
 */
export async function createClientCompany(
  input: { companyName: string; managerName: string; managerEmail: string },
  createdByUid: string
): Promise<CreateClientResult> {
  const db = getDb();
  const companyName = input.companyName.trim();
  const managerName = input.managerName.trim();
  const managerEmail = input.managerEmail.trim().toLowerCase();

  // 1. Gera um código de empresa único.
  let companyId: string | null = null;
  for (let attempt = 0; attempt < 5 && !companyId; attempt++) {
    const code = generateCompanyCode();
    const ref = db.collection("companies").doc(code);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        name: companyName,
        createdBy: createdByUid,
        createdAt: Timestamp.now(),
      });
      companyId = code;
    }
  }
  if (!companyId) {
    throw new ProvisioningError(
      "Não foi possível gerar um código de empresa único. Tente novamente.",
      500
    );
  }

  // 2. Cria a conta do gerente e o perfil.
  const managerUid = await createAuthAccount(managerEmail, managerName);
  await db.collection("users").doc(managerUid).set({
    name: managerName,
    email: managerEmail,
    companyId,
    role: "gerente" satisfies UserRole,
    active: true,
    createdAt: Timestamp.now(),
  });

  return { companyId, managerUid, managerEmail };
}

export interface CompanySummary {
  id: string;
  name: string;
  createdAt: number | null;
  userCount: number;
  whatsappConfigured: boolean;
}

/** Lista as empresas cadastradas (docs companies) para o painel da plataforma. */
export async function listClientCompanies(): Promise<CompanySummary[]> {
  const db = getDb();
  const snap = await db.collection("companies").get();
  const ids = snap.docs.map((doc) => doc.id);

  // Nº de usuários por empresa (aggregate count — barato) e status da API
  // WhatsApp (um findMany só no MariaDB).
  const [userCounts, settings] = await Promise.all([
    Promise.all(
      ids.map((id) =>
        db
          .collection("users")
          .where("companyId", "==", id)
          .count()
          .get()
          .then((res) => [id, res.data().count] as const)
          .catch(() => [id, 0] as const)
      )
    ),
    ids.length
      ? import("./db").then(({ getSql }) =>
          getSql().companySettings.findMany({
            where: { companyId: { in: ids } },
            select: { companyId: true, apiKeySecret: true },
          })
        )
      : Promise.resolve([]),
  ]);
  const userCountById = new Map(userCounts);
  const whatsappById = new Map(
    settings.map((s) => [s.companyId, Boolean(s.apiKeySecret)])
  );

  return snap.docs
    .map((doc) => {
      const data = doc.data() as { name?: string; createdAt?: Timestamp };
      return {
        id: doc.id,
        name: data.name || doc.id,
        createdAt: data.createdAt?.toMillis?.() ?? null,
        userCount: userCountById.get(doc.id) ?? 0,
        whatsappConfigured: whatsappById.get(doc.id) ?? false,
      };
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export interface DeleteClientResult {
  companyId: string;
  usersDeleted: number;
}

/**
 * Exclui um cliente por completo: contas Firebase (Auth + docs users),
 * doc companies/{id} com subcoleções (checklist) e TODOS os dados
 * operacionais no MariaDB. Irreversível — o handler deve exigir confirmação.
 */
export async function deleteClientCompany(
  companyId: string
): Promise<DeleteClientResult> {
  const defaultCompanyId = process.env.CRM_DEFAULT_COMPANY_ID?.trim();
  if (defaultCompanyId && companyId === defaultCompanyId) {
    throw new ProvisioningError(
      "A empresa principal da plataforma não pode ser excluída.",
      400
    );
  }

  const db = getDb();
  const companyRef = db.collection("companies").doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    throw new ProvisioningError("Empresa não encontrada.", 404);
  }

  // 1. Usuários da empresa: contas Auth + docs users/{uid}.
  const usersSnap = await db
    .collection("users")
    .where("companyId", "==", companyId)
    .get();
  let usersDeleted = 0;
  for (const doc of usersSnap.docs) {
    await getAdminAuth()
      .deleteUser(doc.id)
      .catch(() => null); // conta pode já não existir
    await doc.ref.delete();
    usersDeleted++;
  }

  // 2. Doc da empresa + subcoleções (dados do checklist).
  await db.recursiveDelete(companyRef);

  // 3. Dados operacionais no MariaDB (filhos com FK antes dos pais).
  const { getSql } = await import("./db");
  const sql = getSql();
  const where = { companyId };
  await sql.campaignJob.deleteMany({ where });
  await sql.campaign.deleteMany({ where });
  await sql.message.deleteMany({ where });
  await sql.conversation.deleteMany({ where });
  await sql.funnelEvent.deleteMany({ where });
  await sql.deal.deleteMany({ where });
  await sql.pipelineStage.deleteMany({ where });
  await sql.contactList.deleteMany({ where });
  await sql.contact.deleteMany({ where });
  await sql.contactOrigin.deleteMany({ where });
  await sql.template.deleteMany({ where });
  await sql.quickReply.deleteMany({ where });
  await sql.mediaAsset.deleteMany({ where });
  await sql.integrationEvent.deleteMany({ where });
  await sql.dailyStats.deleteMany({ where });
  await sql.webhookEvent.deleteMany({ where });
  await sql.whatsAppMessageRef.deleteMany({ where });
  await sql.presence.deleteMany({ where });
  await sql.connection.deleteMany({ where });
  await sql.companySettings.deleteMany({ where: { companyId } });

  return { companyId, usersDeleted };
}

export interface CreateTeamMemberResult {
  uid: string;
  email: string;
}

/**
 * Cria um colaborador na empresa do criador. O teto de papel já deve ter sido
 * validado no handler (canAssignRole). Retorna dados para disparo do e-mail.
 */
export async function createTeamMember(
  input: { name: string; email: string; role: UserRole },
  scope: { companyId: string }
): Promise<CreateTeamMemberResult> {
  const db = getDb();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  const uid = await createAuthAccount(email, name);
  await db.collection("users").doc(uid).set({
    name,
    email,
    companyId: scope.companyId,
    role: input.role,
    active: true,
    createdAt: Timestamp.now(),
  });

  return { uid, email };
}
