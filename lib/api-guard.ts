import type { AuthContext } from "./auth-server";
import { can, type Permission } from "./permissions";

export function requireAuth(
  auth: AuthContext | null
): { ok: true; auth: AuthContext } | { ok: false; status: number; error: string } {
  if (!auth) {
    return { ok: false, status: 401, error: "Não autorizado." };
  }
  return { ok: true, auth };
}

export function requirePermission(
  auth: AuthContext | null,
  permission: Permission
): { ok: true; auth: AuthContext } | { ok: false; status: number; error: string } {
  const authResult = requireAuth(auth);
  if (!authResult.ok) return authResult;
  if (!can(authResult.auth, permission)) {
    return { ok: false, status: 403, error: "Sem permissão para esta ação." };
  }
  return authResult;
}
