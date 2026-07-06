#!/usr/bin/env bash
# Setup completo de uma VPS Ubuntu para o Ultra Hub CRM.
# Uso: DOMAIN=app.exemplo.com.br bash deploy/vps/setup-server.sh
# Idempotente: pode rodar de novo sem quebrar o que já existe.
set -euo pipefail

DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ]; then
  echo "ERRO: defina o domínio. Ex.: DOMAIN=app.exemplo.com.br bash $0"
  exit 1
fi

echo "==> Setup para o domínio: $DOMAIN"

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

echo "==> Instalando MariaDB (se necessário)..."
if ! command -v mariadb >/dev/null 2>&1 && ! command -v mysql >/dev/null 2>&1; then
  apt-get update
  apt-get install -y mariadb-server
fi
systemctl enable --now mariadb

# Escuta só local — o app roda na própria VPS; acesso externo via túnel SSH.
cat > /etc/mysql/mariadb.conf.d/90-ultrahub.cnf <<'CNF'
[mysqld]
bind-address = 127.0.0.1
CNF
systemctl restart mariadb

echo "==> Criando banco ultrahub e usuário (se necessário)..."
if mysql -N -e "SELECT 1 FROM mysql.user WHERE User='ultrahub' AND Host='localhost'" | grep -q 1; then
  echo "usuário ultrahub já existe — mantendo a senha atual."
else
  DB_PASSWORD=$(openssl rand -hex 24)
  mysql <<SQL
CREATE DATABASE IF NOT EXISTS ultrahub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ultrahub'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ultrahub.* TO 'ultrahub'@'localhost';
FLUSH PRIVILEGES;
SQL
  echo ""
  echo "================================================================"
  echo "ANOTE — usuário do banco criado agora:"
  echo "DATABASE_URL=mysql://ultrahub:${DB_PASSWORD}@127.0.0.1:3306/ultrahub"
  echo "================================================================"
  echo ""
fi

echo "==> Provisionando backup diário do MariaDB..."
mkdir -p /var/backups/mariadb
cat > /usr/local/bin/backup-ultrahub.sh <<'BKP'
#!/usr/bin/env bash
set -euo pipefail
DEST=/var/backups/mariadb
STAMP=$(date +%Y%m%d-%H%M%S)
mysqldump --single-transaction --quick --databases ultrahub | gzip > "$DEST/ultrahub-$STAMP.sql.gz"
# retém 7 dias
find "$DEST" -name 'ultrahub-*.sql.gz' -mtime +7 -delete
BKP
chmod +x /usr/local/bin/backup-ultrahub.sh
cat > /etc/cron.d/backup-ultrahub <<'CRON'
30 3 * * * root /usr/local/bin/backup-ultrahub.sh >/var/log/backup-ultrahub.log 2>&1
CRON
chmod 644 /etc/cron.d/backup-ultrahub

echo "==> Nginx (se necessário)..."
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

echo "==> Instalando certbot (se necessário)..."
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

if [ -f /var/www/ultra-api/deploy/vps/nginx-crm.conf ]; then
  sed "s/__DOMAIN__/${DOMAIN}/g" /var/www/ultra-api/deploy/vps/nginx-crm.conf \
    > /etc/nginx/sites-available/ultra-api
  ln -sf /etc/nginx/sites-available/ultra-api /etc/nginx/sites-enabled/ultra-api
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  # Se o DNS já aponta para esta VPS, emite/renova o certificado.
  certbot --nginx -d "$DOMAIN" --non-interactive --redirect \
    --agree-tos -m mr.misterhub@gmail.com || \
    echo "AVISO: certbot falhou (DNS ainda não propagou?) — rode depois: certbot --nginx -d $DOMAIN"
else
  echo "AVISO: código ainda não enviado — nginx será configurado no deploy."
fi

echo "==> Setup concluído. Envie o código e .env.production, depois rode deploy-remote.sh"
