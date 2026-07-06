import type { NextRequest } from "next/server";
import type { AuthContext } from "./auth-server";

/**
 * Super-admin da plataforma (o dono). Identificado por lista de e-mails em
 * env var — fica fora do banco, então ninguém se autopromove mexendo no
 * Firestore. É ortogonal aos papéis (UserRole): um platform admin também tem
 * seu doc `users` normal, mas ganha poderes cross-empresa (cadastrar clientes).
 */
function platformAdminEmails(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isPlatformAdmin(
  actor: { email?: string | null } | null | undefined
): boolean {
  const email = actor?.email?.trim().toLowerCase();
  if (!email) return false;
  return platformAdminEmails().has(email);
}

export function requirePlatformAdmin(
  auth: AuthContext | null
): { ok: true; auth: AuthContext } | { ok: false; status: number; error: string } {
  if (!auth) {
    return { ok: false, status: 401, error: "Não autorizado." };
  }
  if (!isPlatformAdmin(auth)) {
    return { ok: false, status: 403, error: "Ação restrita ao administrador da plataforma." };
  }
  return { ok: true, auth };
}

/**
 * Autentica e exige platform admin SEM exigir companyId — o admin da
 * plataforma pode não ter empresa própria. Usar nas rotas /api/platform/*.
 * (Import dinâmico do auth-server para evitar ciclo de módulos: auth-server
 * importa isPlatformAdmin daqui.)
 */
export async function resolvePlatformAdminOrError(
  request: NextRequest
): Promise<
  { ok: true; auth: AuthContext } | { ok: false; status: number; error: string }
> {
  const { verifyAuthTokenWithReason, getAuthFailureMessage } = await import(
    "./auth-server"
  );
  const { auth, reason } = await verifyAuthTokenWithReason(
    request.headers.get("authorization")
  );
  if (!auth) {
    return {
      ok: false,
      status: 401,
      error: getAuthFailureMessage(reason || "missing_header"),
    };
  }
  if (!auth.platformAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Ação restrita ao administrador da plataforma.",
    };
  }
  return { ok: true, auth };
}
