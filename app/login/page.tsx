"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { UltraWordmark } from "@/components/brand/UltraWordmark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
    } catch {
      setError("E-mail ou senha inválidos. Use a mesma conta do Task Checklist.");
    } finally {
      setLoading(false);
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
        </form>
      </div>
    </div>
  );
}
