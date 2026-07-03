#!/usr/bin/env bash
# Rode NA VPS apos enviar o codigo atualizado (hPanel File Manager ou git pull)
set -euo pipefail
cd /var/www/ultra-api
if [ -f .env.local ] && [ ! -f .env.production ]; then
  cp .env.local .env.production
fi
chmod +x deploy/vps/*.sh
bash deploy/vps/deploy-remote.sh
