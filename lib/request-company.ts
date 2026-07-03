import type { NextRequest } from "next/server";
import {
  verifyAuthTokenWithReason,
  getDefaultCompanyId,
  getAuthFailureMessage,
  type AuthContext,
} from "./auth-server";

export interface RequestCompanyContext {
  companyId: string;
  auth: AuthContext | null;
}

export async function resolveCompanyContext(
  request: NextRequest,
  options?: { allowDefault?: boolean }
): Promise<RequestCompanyContext | null> {
  const { auth, reason } = await verifyAuthTokenWithReason(
    request.headers.get("authorization")
  );

  if (auth?.companyId) {
    return { companyId: auth.companyId, auth };
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

  if (auth?.companyId) {
    return { ok: true, context: { companyId: auth.companyId, auth } };
  }

  return {
    ok: false,
    error: getAuthFailureMessage(reason || "missing_header"),
    status: 401,
  };
}
