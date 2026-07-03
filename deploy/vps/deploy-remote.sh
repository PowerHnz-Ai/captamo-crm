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
npm run build

PM2_CONFIG="deploy/vps/ecosystem.config.cjs"

echo "==> Reiniciando PM2..."
if pm2 describe ultra-api >/dev/null 2>&1; then
  pm2 restart "$PM2_CONFIG" --update-env
else
  pm2 start "$PM2_CONFIG"
fi
pm2 save

if [ -f scripts/backfill-whatsapp-message-refs.mjs ]; then
  echo "==> Atualizando refs de mensagens WhatsApp..."
  node scripts/backfill-whatsapp-message-refs.mjs || true
fi

echo "==> Health check local..."
sleep 2
curl -sf "http://127.0.0.1:3010/api/health" | head -c 200
echo ""
echo "==> Deploy concluído."
