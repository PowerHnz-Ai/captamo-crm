#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/ultra-api"
cd "$APP_DIR"

if [ ! -f .env.production ]; then
  if [ -f .env.local ]; then
    cp .env.local .env.production
  else
    echo "ERRO: Crie $APP_DIR/.env.production (copie de .env.production.example)"
    exit 1
  fi
fi

echo "==> Instalando dependências..."
npm ci

echo "==> Garantindo binário ffmpeg-static..."
if [ -f node_modules/ffmpeg-static/ffmpeg ]; then
  chmod +x node_modules/ffmpeg-static/ffmpeg
fi

echo "==> Build de produção..."
# Remove arquivos obsoletos que o tar não apaga (extração sobrescreve, não limpa).
rm -f components/chat/AudioRecorderButton.tsx

export NODE_ENV=production
set -a
# shellcheck disable=SC1091
source .env.production
set +a

echo "==> Aplicando migrations do MariaDB..."
npx prisma migrate deploy

echo "==> Seed mínimo (empresa padrão + conexão)..."
if [ -f scripts/seed-company.mjs ]; then
  node scripts/seed-company.mjs || true
fi

npm run build

# Cron de campanhas: processa agendadas/cadência a cada minuto.
echo "==> Provisionando cron de campanhas..."
if [ -z "${CRON_SECRET:-}" ]; then
  echo "AVISO: CRON_SECRET ausente no .env.production — cron de campanhas NÃO instalado."
else
  cat > /etc/cron.d/ultra-campaigns <<CRON
* * * * * root curl -s -m 55 -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://127.0.0.1:3010/api/campaigns/process >/var/log/ultra-campaigns-cron.log 2>&1
CRON
  chmod 644 /etc/cron.d/ultra-campaigns
  echo "cron instalado em /etc/cron.d/ultra-campaigns"
fi

PM2_CONFIG="deploy/vps/ecosystem.config.cjs"

# IMPORTANTE: recriamos o processo (delete + start) em vez de `restart --update-env`.
# O daemon do pm2 guarda um env próprio e o injeta nos filhos; `@next/env` NÃO
# sobrescreve env já definido, então um `restart --update-env` com shell "sujo"
# pode fixar valores ANTIGOS (ex.: chave Firebase rotacionada, PLATFORM_ADMIN_EMAILS
# desatualizado) e quebrar a autenticação. Start limpo garante que o `next start`
# leia o .env.production atual como fonte de verdade.
echo "==> (Re)iniciando PM2 do zero (evita env obsoleto do daemon)..."
pm2 delete ultra-api >/dev/null 2>&1 || true
pm2 start "$PM2_CONFIG"
pm2 save

echo "==> Health check local..."
sleep 2
curl -sf "http://127.0.0.1:3010/api/health" | head -c 200
echo ""
echo "==> Deploy concluído."
