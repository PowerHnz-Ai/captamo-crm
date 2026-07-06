# Deploy do Ultra Hub CRM na VPS

O CRM Next.js roda via PM2 na **porta 3010**, atrás do nginx (proxy reverso).
Para migração completa de servidor/Firebase, ver [MIGRACAO.md](MIGRACAO.md).

## Pré-requisitos

- Acesso SSH root à VPS (chave recomendada; configure um alias no `~/.ssh/config`)
- `.env.production` preenchido na VPS (modelo: `.env.production.example`)

### Se deu "Permission denied" ou "Connection timed out"

Várias senhas erradas podem bloquear o IP por alguns minutos (fail2ban).
**Aguarde 15–30 min** ou use o **terminal do hPanel** da Hostinger (VPS → Terminal).

## Primeira vez em uma VPS nova

```powershell
cd "C:\Users\Power\Ultra API"
tar -czf $env:TEMP\ultra-api.tar.gz --exclude=node_modules --exclude=.next --exclude=.git --exclude=".env*" --exclude=.qa .
scp $env:TEMP\ultra-api.tar.gz <alias-vps>:/tmp/
```

Na VPS:

```bash
mkdir -p /var/www/ultra-api
tar -xzf /tmp/ultra-api.tar.gz -C /var/www/ultra-api
cd /var/www/ultra-api
find deploy scripts -name '*.sh' -exec sed -i 's/\r$//' {} +
chmod +x deploy/vps/*.sh
DOMAIN=<dominio-do-crm> bash deploy/vps/setup-server.sh   # Node, PM2, ffmpeg, nginx, MariaDB, certbot, backup
# criar /var/www/ultra-api/.env.production (anotar a DATABASE_URL impressa pelo setup)
bash deploy/vps/deploy-remote.sh
```

O `setup-server.sh` é idempotente e instala: Node 20, PM2, ffmpeg, nginx
(conf gerada de `deploy/vps/nginx-crm.conf` com o domínio informado), MariaDB
(banco `ultrahub` + usuário com senha gerada), certbot (TLS automático se o
DNS já aponta) e o backup diário do banco (03:30, retenção 7 dias).

## Atualizações (deploy de rotina)

```powershell
cd "C:\Users\Power\Ultra API"
tar -czf $env:TEMP\ultra-api.tar.gz --exclude=node_modules --exclude=.next --exclude=.git --exclude=".env*" --exclude=.qa .
scp $env:TEMP\ultra-api.tar.gz <alias-vps>:/tmp/
ssh <alias-vps> "cd /var/www/ultra-api && tar -xzf /tmp/ultra-api.tar.gz -C . && find deploy scripts -name '*.sh' -exec sed -i 's/\r$//' {} + && bash deploy/vps/deploy-remote.sh"
```

O `deploy-remote.sh` roda: `npm ci` → `prisma migrate deploy` → seed →
`npm run build` → provisiona o cron de campanhas (exige `CRON_SECRET` no env)
→ `pm2 restart` → health check.

## Validar deploy

```bash
curl "http://127.0.0.1:3010/api/health"
curl "https://<dominio>/api/webhook/whatsapp/meta?hub.mode=subscribe&hub.verify_token=<WHATSAPP_VERIFY_TOKEN>&hub.challenge=ok"
```

A segunda URL deve retornar **apenas** `ok` (texto).

## Meta — Webhook

1. URL: `https://<dominio>/api/webhook/whatsapp/meta`
2. Token: o valor de `WHATSAPP_VERIFY_TOKEN` do `.env.production`
3. Assinar o campo **messages**
4. Se o app não estiver publicado, adicione o número de teste na Meta

## Checklist embutido

O CRM serve o checklist em `/checklist` (copiado de `task-checklist/` no
`npm run build`).
