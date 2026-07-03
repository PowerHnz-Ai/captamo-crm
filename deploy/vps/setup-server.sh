#!/usr/bin/env bash
set -euo pipefail

echo "==> Instalando Node.js 20 (se necessário)..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Node: $(node -v) | npm: $(npm -v)"

echo "==> Instalando PM2..."
npm install -g pm2

echo "==> Instalando ffmpeg (conversão de áudio para WhatsApp)..."
if ! command -v ffmpeg >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ffmpeg
fi

echo "==> Criando pasta do app..."
mkdir -p /var/www/ultra-api

echo "==> Nginx (se necessário)..."
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

if [ -f /var/www/ultra-api/deploy/vps/nginx-app.misterodonto.conf ]; then
  cp /var/www/ultra-api/deploy/vps/nginx-app.misterodonto.conf /etc/nginx/sites-available/ultra-api
  ln -sf /etc/nginx/sites-available/ultra-api /etc/nginx/sites-enabled/ultra-api
  rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/meu-checklist
  nginx -t
  systemctl reload nginx
  if [ -d /etc/letsencrypt/live/app.misterodonto.com.br ]; then
    certbot --nginx -d app.misterodonto.com.br --non-interactive --redirect || true
  fi
fi

echo "==> Setup concluído. Envie o código e .env.production, depois rode deploy-remote.sh"
