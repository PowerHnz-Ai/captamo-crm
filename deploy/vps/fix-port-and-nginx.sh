#!/usr/bin/env bash
# Easypanel usa a porta 3000 — CRM roda na 3010
set -euo pipefail
cd /var/www/ultra-api

APP_PORT=3010

echo "==> Portas em uso:"
ss -tlnp | grep -E ':3000|:3010' || true

echo "==> PM2 na porta ${APP_PORT}..."
sed -i 's/-p 3000/-p 3010/g; s/PORT: "3000"/PORT: "3010"/g' deploy/vps/ecosystem.config.cjs
pm2 delete ultra-api 2>/dev/null || true
pm2 start deploy/vps/ecosystem.config.cjs
pm2 save
sleep 3

echo "==> Teste local CRM:"
curl -sf "http://127.0.0.1:${APP_PORT}/api/health" | head -c 120
echo ""
curl -sf "http://127.0.0.1:${APP_PORT}/api/webhook/whatsapp/meta?hub.mode=subscribe&hub.verify_token=misterhubcrm_webhook_2026&hub.challenge=ok"
echo ""

DOMAIN="app.misterodonto.com.br"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

echo "==> Nginx -> ${APP_PORT}..."
cp deploy/vps/nginx-app.misterodonto.conf /etc/nginx/sites-available/ultra-api
sed -i "s/127.0.0.1:3010/127.0.0.1:${APP_PORT}/g" /etc/nginx/sites-available/ultra-api
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/meu-checklist
ln -sf /etc/nginx/sites-available/ultra-api /etc/nginx/sites-enabled/ultra-api

if [ -f "${CERT_DIR}/fullchain.pem" ]; then
  cat > /etc/nginx/sites-available/ultra-api <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
EOF
fi

nginx -t
systemctl reload nginx
echo "==> Pronto. Teste no navegador o webhook."
