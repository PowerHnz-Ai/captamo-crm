"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { UltraWordmark } from "@/components/brand/UltraWordmark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { sendResetEmail, passwordErrorMessage } from "@/lib/password-actions";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
    } catch {
      setError("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setError("");
    try {
      await sendResetEmail(email);
      setResetDone(true);
    } catch (err) {
      // Mensagem neutra: não revela se o e-mail existe.
      if ((err as { code?: string }).code === "auth/invalid-email") {
        setError("Informe um e-mail válido.");
      } else if ((err as { code?: string }).code === "auth/too-many-requests") {
        setError(passwordErrorMessage(err));
      } else {
        setResetDone(true);
      }
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="mesh-bg" aria-hidden />
      <div className="glass-card w-full max-w-md p-6 md:p-8">
        <div className="mb-6">
          <UltraWordmark variant="hub" size="xl" />
          <p className="mt-2 text-sm text-app-muted">Ultra API + Ultra Operacional</p>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="login-email"
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            <Input
              id="login-password"
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Entrar
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setError("");
                setResetDone(false);
              }}
              className="w-full text-center text-sm text-app-muted transition-colors hover:text-app-text"
            >
              Esqueci minha senha
            </button>
          </form>
        ) : resetDone ? (
          <div className="space-y-4">
            <p className="text-sm text-app-subtle">
              Se houver uma conta com esse e-mail, enviamos um link para você
              definir uma nova senha. Verifique a caixa de entrada e o spam.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setMode("login")}
            >
              Voltar ao login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-app-subtle">
              Informe seu e-mail e enviaremos um link para redefinir a senha.
            </p>
            <Input
              id="reset-email"
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" loading={resetLoading}>
              Enviar link de redefinição
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className="w-full text-center text-sm text-app-muted transition-colors hover:text-app-text"
            >
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
