import type { NextRequest } from "next/server";
import {
  verifyAuthTokenWithReason,
  getDefaultCompanyId,
  getAuthFailureMessage,
  type AuthContext,
} from "./auth-server";
import { IMPERSONATION_HEADER } from "./impersonation";

export interface RequestCompanyContext {
  companyId: string;
  auth: AuthContext | null;
  /** true quando um platform admin está atuando como esta empresa. */
  impersonated?: boolean;
}

/**
 * Impersonação: platform admin atuando como uma empresa. O header só é
 * honrado para platform admins; para qualquer outro usuário é ignorado
 * silenciosamente (storage residual nunca deve soft-brickar uma sessão).
 * Durante a impersonação o role é forçado a "admin" (poder total na empresa).
 */
function applyImpersonation(
  request: NextRequest,
  auth: AuthContext
): RequestCompanyContext | null {
  const target = request.headers.get(IMPERSONATION_HEADER)?.trim();
  if (!target || !auth.platformAdmin) return null;
  return {
    companyId: target,
    auth: { ...auth, companyId: target, role: "admin", cargo: undefined },
    impersonated: true,
  };
}

export async function resolveCompanyContext(
  request: NextRequest,
  options?: { allowDefault?: boolean }
): Promise<RequestCompanyContext | null> {
  const { auth, reason } = await verifyAuthTokenWithReason(
    request.headers.get("authorization")
  );

  if (auth) {
    const impersonated = applyImpersonation(request, auth);
    if (impersonated) return impersonated;
    if (auth.companyId) return { companyId: auth.companyId, auth };
  }

  if (options?.allowDefault) {
    try {
      return { companyId: getDefaultCompanyId(), auth: null };
    } catch {
      return null;
    }
  }

  if (process.env.NODE_ENV === "development" && reason) {
    console.warn("[auth] resolveCompanyContext:", reason);
  }

  return null;
}

export async function resolveCompanyContextOrError(
  request: NextRequest
): Promise<
  | { ok: true; context: RequestCompanyContext }
  | { ok: false; error: string; status: number }
> {
  const header = request.headers.get("authorization");
  const { auth, reason } = await verifyAuthTokenWithReason(header);

  if (auth) {
    const impersonated = applyImpersonation(request, auth);
    if (impersonated) return { ok: true, context: impersonated };
    if (auth.companyId) {
      return { ok: true, context: { companyId: auth.companyId, auth } };
    }
  }

  return {
    ok: false,
    error: getAuthFailureMessage(reason || "company_missing"),
    status: 401,
  };
}
