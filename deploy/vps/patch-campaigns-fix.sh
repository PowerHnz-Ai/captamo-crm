#!/usr/bin/env bash
# Aplica correcao TypeScript em campaigns/page.tsx (rode na VPS)
set -euo pipefail
cd /var/www/ultra-api
FILE="app/(app)/campaigns/page.tsx"

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
    print("FIX_OK: ja aplicado")
elif old not in text:
    raise SystemExit("ERRO: bloco antigo nao encontrado — faca upload manual de page.tsx")
else:
    path.write_text(text.replace(old, new))
    print("FIX_APLICADO")
PY

grep -q "campaigns\?:" "$FILE" && echo "Verificado."
