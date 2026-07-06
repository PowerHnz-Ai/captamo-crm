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
