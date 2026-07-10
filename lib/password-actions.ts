"use client";

import {
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase-client";

/**
 * Dispara o e-mail nativo do Firebase para (re)definir a senha. Usado no
 * "esqueci minha senha", no 1º acesso de contas novas e no reset pelo gerente.
 * Não revela se o e-mail existe (mensagem neutra fica na UI).
 */
export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

/**
 * Preferencial: e-mail de redefinição com o template da Captamo (português,
 * remetente próprio, via rota do servidor). Se o SMTP estiver indisponível,
 * cai automaticamente no e-mail nativo do Firebase — ninguém fica sem link.
 */
export async function sendResetEmailSmart(email: string): Promise<void> {
  try {
    const res = await fetch("/api/auth/password-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = (await res.json()) as { sent?: boolean };
    if (res.ok && data.sent) return;
  } catch {
    // servidor fora — usa o fallback abaixo
  }
  await sendResetEmail(email);
}

/**
 * Troca a senha do usuário logado. Reautentica com a senha atual (exigência do
 * Firebase para operações sensíveis) e então grava a nova.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error("Sessão inválida. Entre novamente.");
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/** Mensagem amigável para erros comuns do Firebase Auth. */
export function passwordErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code;
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Senha atual incorreta.";
    case "auth/weak-password":
      return "A nova senha deve ter pelo menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    case "auth/requires-recent-login":
      return "Por segurança, entre novamente antes de trocar a senha.";
    default:
      return error instanceof Error ? error.message : "Erro ao processar a senha.";
  }
}
