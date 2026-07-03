"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, ListChecks, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { UltraWordmark } from "@/components/brand/UltraWordmark";
import Link from "next/link";
import { setUltraMode } from "@/lib/ultra-mode";
import { CHECKLIST_ENTRY_PATH } from "@/lib/checklist-path";

export default function HubPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  function enterApi() {
    setUltraMode("api");
    router.push("/");
  }

  function enterOperacional() {
    setUltraMode("operacional");
    window.location.href = CHECKLIST_ENTRY_PATH;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="mesh-bg" aria-hidden />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <UltraWordmark variant="hub" size="xl" className="text-4xl md:text-5xl" />
          </div>
          <p className="mt-2 text-app-subtle">
            Olá, {user?.email}. Escolha a sessão para continuar.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={enterApi}
            className="glass-card group cursor-pointer p-6 text-left"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-app-accent/15 text-app-accent">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-semibold">Ultra API</h2>
            <p className="mt-2 text-sm text-app-subtle">
              Contatos, conversas WhatsApp, templates, campanhas e relatórios.
            </p>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={enterOperacional}
            className="glass-card group cursor-pointer p-6 text-left"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-app-accent/15 text-app-accent">
              <ListChecks className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-semibold">Ultra Operacional</h2>
            <p className="mt-2 text-sm text-app-subtle">
              Checklist de tarefas, agenda e pronta entrega da equipe.
            </p>
          </motion.button>
        </div>

        <div className="mt-6 flex justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-2 text-app-muted hover:text-app-text"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
          <Link href="/settings/integrations" className="text-app-muted hover:text-app-text">
            Integrações
          </Link>
        </div>
      </div>
    </div>
  );
}
