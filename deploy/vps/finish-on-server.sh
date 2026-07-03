#!/usr/bin/env bash
# Rode NA VPS (hPanel terminal ou ssh) se o deploy do Windows falhar no meio.
set -euo pipefail

REMOTE_PATH="/var/www/ultra-api"

echo "==> Extraindo codigo (se tar existir)..."
if [ -f /tmp/ultra-api-deploy.tar.gz ]; then
  mkdir -p "$REMOTE_PATH"
  tar -xzf /tmp/ultra-api-deploy.tar.gz -C "$REMOTE_PATH"
  rm -f /tmp/ultra-api-deploy.tar.gz
  echo "Tar extraido."
else
  echo "Sem tar em /tmp. Certifique-se de que o codigo esta em $REMOTE_PATH"
fi

if [ -f "$REMOTE_PATH/.env.local" ] && [ ! -f "$REMOTE_PATH/.env.production" ]; then
  cp "$REMOTE_PATH/.env.local" "$REMOTE_PATH/.env.production"
fi

if [ ! -f "$REMOTE_PATH/.env.production" ]; then
  echo "ERRO: Crie $REMOTE_PATH/.env.production (copie do .env.local do seu PC)"
  exit 1
fi

cd "$REMOTE_PATH"
chmod +x deploy/vps/*.sh
bash deploy/vps/setup-server.sh
bash deploy/vps/deploy-remote.sh

echo "==> Teste local:"
curl -sf "http://127.0.0.1:3010/api/health" || true
echo ""
echo "Pronto. Teste o webhook no navegador."
