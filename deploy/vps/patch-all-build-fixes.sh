#!/usr/bin/env bash
# Aplica todas as correcoes TypeScript conhecidas para o build de producao
set -euo pipefail
cd /var/www/ultra-api

echo "==> Patch campaigns/page.tsx"
python3 <<'PY'
from pathlib import Path
path = Path("app/(app)/campaigns/page.tsx")
text = path.read_text()
old = """    Promise.all([
      apiFetch("/api/campaigns").then((r) => parseApiJson(r)),
      apiFetch("/api/contact-lists").then((r) => parseApiJson(r)),
      apiFetch("/api/reports/overview?days=1").then((r) => parseApiJson(r)),
      apiFetch("/api/templates").then((r) => parseApiJson(r)),
    ])"""
new = """    Promise.all([
      apiFetch("/api/campaigns").then((r) =>
        parseApiJson<{ campaigns?: Campaign[] }>(r)
      ),
      apiFetch("/api/contact-lists").then((r) =>
        parseApiJson<{ lists?: ContactList[] }>(r)
      ),
      apiFetch("/api/reports/overview?days=1").then((r) =>
        parseApiJson<{
          limits?: {
            sentToday: number;
            dailyCap: number;
            remaining: number;
            tier: number;
          };
        }>(r)
      ),
      apiFetch("/api/templates").then((r) =>
        parseApiJson<{ templates?: Template[] }>(r)
      ),
    ])"""
if "parseApiJson<{ campaigns?: Campaign[] }>" in text:
    print("campaigns: ja ok")
elif old in text:
    path.write_text(text.replace(old, new))
    print("campaigns: aplicado")
else:
    print("campaigns: pulado (bloco nao encontrado)")
PY

echo "==> Patch contacts/page.tsx"
python3 <<'PY'
from pathlib import Path
path = Path("app/(app)/contacts/page.tsx")
text = path.read_text()
old = """  async function loadContacts(): Promise<{
    contacts: Contact[];
    lists: ContactList[];
  }> {"""
new = """  async function loadContacts(): Promise<{
    contacts: Contact[];
    lists: ContactList[];
    origins: ContactOrigin[];
  }> {"""
if "origins: ContactOrigin[];" in text.split("loadContacts", 1)[1][:400]:
    print("contacts: ja ok")
elif old in text:
    path.write_text(text.replace(old, new))
    print("contacts: aplicado")
else:
    print("contacts: pulado")
PY

echo "==> Patch components/ui/Card.tsx"
cat > components/ui/Card.tsx <<'EOF'
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = "", hover = true }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`glass-card p-5 ${hover ? "hover:-translate-y-0.5" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
EOF
echo "card: aplicado"

echo "==> Patch funnel/page.tsx"
python3 <<'PY'
from pathlib import Path
path = Path("app/(app)/funnel/page.tsx")
text = path.read_text()
old = """                  {stageDeals.map((deal) => (
                    <Card
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggingId(deal.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <p className="font-medium">{deal.title}</p>
                      {deal.value != null && (
                        <p className="mt-1 text-sm text-app-muted">
                          R$ {deal.value.toLocaleString("pt-BR")}
                        </p>
                      )}
                      {deal.source && (
                        <p className="mt-1 text-xs text-app-subtle">{deal.source}</p>
                      )}
                    </Card>
                  ))}"""
new = """                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggingId(deal.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <Card hover={false}>
                        <p className="font-medium">{deal.title}</p>
                        {deal.value != null && (
                          <p className="mt-1 text-sm text-app-muted">
                            R$ {deal.value.toLocaleString("pt-BR")}
                          </p>
                        )}
                        {deal.source && (
                          <p className="mt-1 text-xs text-app-subtle">{deal.source}</p>
                        )}
                      </Card>
                    </div>
                  ))}"""
if "<Card hover={false}>" in text:
    print("funnel: ja ok")
elif old in text:
    path.write_text(text.replace(old, new))
    print("funnel: aplicado")
else:
    print("funnel: pulado")
PY

echo "==> Patch components/ui/Button.tsx"
cat > components/ui/Button.tsx <<'EOF'
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "whatsapp" | "ghost";
  loading?: boolean;
}

const variants = {
  primary:
    "bg-app-accent text-white hover:bg-app-accent-hover shadow-md hover:shadow-lg",
  secondary:
    "bg-app-secondary text-app-subtle border border-app-border hover:text-app-text hover:border-app-accent/40",
  danger: "bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25",
  whatsapp:
    "bg-app-whatsapp/20 text-emerald-100 border border-app-whatsapp/40 hover:bg-app-whatsapp/30",
  ghost:
    "bg-transparent text-app-subtle border border-transparent hover:bg-app-secondary hover:text-app-text",
};

export function Button({
  children,
  variant = "primary",
  loading,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Enviando..." : children}
    </button>
  );
}
EOF
echo "button: aplicado"

echo "==> Patch lib/firestore-repositories.ts"
python3 <<'PY'
from pathlib import Path
path = Path("lib/firestore-repositories.ts")
text = path.read_text()
if '| "phone"' in text.split("updateContact", 1)[1][:500]:
    print("firestore: ja ok")
else:
    text = text.replace('| "name"\n      | "source"', '| "name"\n      | "phone"\n      | "source"', 1)
    path.write_text(text)
    print("firestore: aplicado")
PY

echo "==> Patch lib/lead-assignment.ts"
python3 <<'PY'
from pathlib import Path
path = Path("lib/lead-assignment.ts")
text = path.read_text()
text2 = text.replace("return { uid: doc.id, ...data };", "return { ...data, uid: doc.id };")
text2 = text2.replace("return { uid: doc.id, ...data, role };", "return { ...data, uid: doc.id, role };")
if text2 == text:
    print("lead-assignment: ja ok")
else:
    path.write_text(text2)
    print("lead-assignment: aplicado")
PY

echo "==> Patch lib/whatsapp/index.ts"
python3 <<'PY'
from pathlib import Path
path = Path("lib/whatsapp/index.ts")
text = path.read_text()
if "type SendTemplateParams" in text:
    print("whatsapp-index: ja ok")
else:
    text = text.replace(
        "  type WhatsAppProvider,\n} from \"./types\";",
        "  type WhatsAppProvider,\n  type SendTemplateParams,\n  type SendTextParams,\n} from \"./types\";",
        1,
    )
    path.write_text(text)
    print("whatsapp-index: aplicado")
PY

echo "==> Patches concluidos"
