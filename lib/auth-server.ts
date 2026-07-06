import { getAdminAuth, getDb, getAdminProjectId } from "./firebase-admin";
import { isUserActive } from "./user-profiles";
import { isPlatformAdmin } from "./platform-admin";

export interface AuthContext {
  uid: string;
  email?: string;
  companyId: string;
  role?: string;
  cargo?: string;
  name?: string;
  username?: string;
  jobTitle?: string;
  photoStoragePath?: string;
  /** Super-admin da plataforma (e-mail em PLATFORM_ADMIN_EMAILS). */
  platformAdmin: boolean;
}

type UserDoc = {
  companyId?: string;
  role?: string;
  email?: string;
  cargo?: string;
  name?: string;
  username?: string;
  jobTitle?: string;
  photoStoragePath?: string;
  active?: boolean;
};

export type AuthFailureReason =
  | "missing_header"
  | "invalid_token"
  | "profile_missing"
  | "company_missing"
  | "account_disabled";

function mapUserToAuth(uid: string, data: UserDoc, fallbackEmail?: string): AuthContext | null {
  if (!data.companyId) return null;
  if (!isUserActive(data)) return null;

  return {
    uid,
    email: data.email || fallbackEmail,
    companyId: data.companyId,
    role: data.role,
    cargo: data.cargo,
    name: data.name,
    username: data.username,
    jobTitle: data.jobTitle,
    photoStoragePath: data.photoStoragePath,
    platformAdmin: false,
  };
}

export async function verifyAuthToken(
  authorizationHeader: string | null
): Promise<AuthContext | null> {
  const { auth } = await verifyAuthTokenWithReason(authorizationHeader);
  return auth;
}

export function getAuthFailureMessage(reason: AuthFailureReason): string {
  switch (reason) {
    case "missing_header":
      return "Sessão expirada. Faça login novamente.";
    case "invalid_token":
      return "Token inválido. Faça login novamente.";
    case "profile_missing":
      return "Perfil não encontrado. Complete o cadastro no Task Checklist.";
    case "company_missing":
      return "Usuário sem empresa vinculada. Entre em uma empresa no Task Checklist.";
    case "account_disabled":
      return "Sua conta foi desativada nesta empresa. Contate um administrador.";
    default:
      return "Não autorizado.";
  }
}

export async function verifyAuthTokenWithReason(
  authorizationHeader: string | null
): Promise<{ auth: AuthContext | null; reason?: AuthFailureReason }> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { auth: null, reason: "missing_header" };
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { auth: null, reason: "missing_header" };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const profile = await getDb().collection("users").doc(decoded.uid).get();

    // Platform admin (por e-mail, via env): autentica mesmo sem doc, sem
    // companyId ou desativado — a identidade vem do env, não do Firestore.
    if (isPlatformAdmin({ email: decoded.email })) {
      const data = profile.exists ? (profile.data() as UserDoc) : {};
      return {
        auth: {
          uid: decoded.uid,
          email: data.email || decoded.email,
          companyId: data.companyId || "",
          role: data.role || "admin",
          cargo: data.cargo,
          name: data.name,
          username: data.username,
          jobTitle: data.jobTitle,
          photoStoragePath: data.photoStoragePath,
          platformAdmin: true,
        },
      };
    }

    if (!profile.exists) {
      return { auth: null, reason: "profile_missing" };
    }

    const data = profile.data() as UserDoc;
    if (!data.companyId) {
      return { auth: null, reason: "company_missing" };
    }
    if (!isUserActive(data)) {
      return { auth: null, reason: "account_disabled" };
    }

    const auth = mapUserToAuth(decoded.uid, data, decoded.email);
    if (!auth) {
      return { auth: null, reason: "company_missing" };
    }

    return { auth };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[auth] verifyIdToken falhou:", message, {
        adminProject: getAdminProjectId(),
      });
    }
    return { auth: null, reason: "invalid_token" };
  }
}

export function getDefaultCompanyId(): string {
  const companyId = process.env.CRM_DEFAULT_COMPANY_ID?.trim();
  if (!companyId) {
    throw new Error(
      "CRM_DEFAULT_COMPANY_ID não configurado. Necessário para webhook e integrações sem login."
    );
  }
  return companyId;
}
