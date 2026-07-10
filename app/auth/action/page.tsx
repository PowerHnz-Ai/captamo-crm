"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { UltraWordmark } from "@/components/brand/UltraWordmark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { sendResetEmailSmart } from "@/lib/password-actions";

/**
 * Página própria de (re)definição de senha — substitui a tela branca hospedada
 * pelo Firebase. Recebe ?oobCode=... dos e-mails da Captamo e conclui a troca
 * com o SDK (verifyPasswordResetCode + confirmPasswordReset).
 */
type Stage = "verifying" | "form" | "done" | "invalid";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const oobCode = params.get("oobCode") || "";

  const [stage, setStage] = useState<Stage>("verifying");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reenvio quando o link expirou/foi usado.
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setStage("invalid");
      return;
    }
    verifyPasswordResetCode(getFirebaseAuth(), oobCode)
      .then((email) => {
        setAccountEmail(email);
        setStage("form");
      })
      .catch(() => setStage("invalid"));
  }, [oobCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setSaving(true);
    try {
      await confirmPasswordReset(getFirebaseAuth(), oobCode, password);
      setStage("done");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
        setStage("invalid");
      } else if (code === "auth/weak-password") {
        setError("Senha fraca — use pelo menos 6 caracteres.");
      } else {
        setError("Não foi possível salvar a senha. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendLoading(true);
    try {
      await sendResetEmailSmart(resendEmail);
    } catch {
      // mensagem neutra abaixo — não revela se o e-mail existe
    } finally {
      setResendDone(true);
      setResendLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="mesh-bg" aria-hidden />
      <div className="glass-card w-full max-w-md p-6 md:p-8">
        <div className="mb-6">
          <UltraWordmark variant="hub" size="xl" />
          <p className="mt-2 text-sm text-app-muted">Definição de senha</p>
        </div>

        {stage === "verifying" && (
          <p className="text-sm text-app-subtle">Verificando o link...</p>
        )}

        {stage === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-app-subtle">
              Defina a nova senha de acesso para{" "}
              <strong className="text-app-text">{accountEmail}</strong>.
            </p>
            <Input
              id="new-password"
              label="Nova senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              required
            />
            <Input
              id="confirm-password"
              label="Confirmar a nova senha"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" loading={saving}>
              Salvar senha
            </Button>
          </form>
        )}

        {stage === "done" && (
          <div className="space-y-4">
            <p className="text-sm text-app-subtle">
              ✅ Senha definida com sucesso! Agora é só entrar com o seu e-mail e
              a nova senha.
            </p>
            <Button type="button" className="w-full" onClick={() => router.push("/login")}>
              Ir para o login
            </Button>
          </div>
        )}

        {stage === "invalid" && (
          <div className="space-y-4">
            <p className="text-sm text-app-subtle">
              Este link expirou ou já foi usado. Sem problema — informe seu
              e-mail que enviamos um novo:
            </p>
            {resendDone ? (
              <>
                <p className="text-sm text-app-subtle">
                  Se houver uma conta com esse e-mail, um novo link foi enviado.
                  Verifique a caixa de entrada e o spam.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push("/login")}
                >
                  Voltar ao login
                </Button>
              </>
            ) : (
              <form onSubmit={handleResend} className="space-y-4">
                <Input
                  id="resend-email"
                  label="E-mail"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
                <Button type="submit" className="w-full" loading={resendLoading}>
                  Enviar novo link
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
