# Deploy do Ultra API CRM na VPS

O domínio `app.misterodonto.com.br` hoje serve o **checklist estático**. Para o webhook da Meta funcionar, o **Next.js CRM** precisa responder em `/api/webhook/whatsapp/meta`.

## Pré-requisitos

- SSH na VPS: `ssh root@31.97.85.113`
- `.env.local` na raiz do projeto (será copiado como `.env.production`)
- Senha SSH correta da Hostinger **ou** chave SSH (recomendado)

### Se deu "Permission denied" ou "Connection timed out"

Várias senhas erradas podem bloquear o IP por alguns minutos (fail2ban). **Aguarde 15–30 min** ou use o **terminal do hPanel** da Hostinger (VPS → Terminal).

O pacote `ultra-api-deploy.tar.gz` pode já estar em `/tmp/` na VPS — use `deploy-recover.ps1` ou `finish-on-server.sh`.

### Chave SSH (evita pedir senha 6x)

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\ultra-api-vps -N '""'
type $env:USERPROFILE\.ssh\ultra-api-vps.pub | ssh root@31.97.85.113 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
$env:ULTRA_API_SSH_KEY = "$env:USERPROFILE\.ssh\ultra-api-vps"
.\deploy\deploy-recover.ps1
```

## Opção A — Script automático (Windows)

```powershell
cd "C:\Users\Power\Ultra API"
.\deploy\deploy.ps1
```

Se pedir senha SSH, digite a senha da Hostinger. O script:

1. Envia o código para `/var/www/ultra-api`
2. Copia `.env.local` → `.env.production`
3. Instala Node 20 + PM2 (primeira vez)
4. Configura Nginx como proxy para porta 3000
5. Roda `npm ci`, `npm run build`, reinicia PM2

## Opção B — Manual na VPS

```bash
ssh root@31.97.85.113
mkdir -p /var/www/ultra-api
```

No seu PC, envie o projeto (sem `node_modules` e `.next`):

```powershell
cd "C:\Users\Power\Ultra API"
tar -czf $env:TEMP\ultra-api.tar.gz --exclude=node_modules --exclude=.next --exclude=.git .
scp $env:TEMP\ultra-api.tar.gz root@31.97.85.113:/tmp/
scp .env.local root@31.97.85.113:/var/www/ultra-api/.env.production
```

Na VPS:

```bash
cd /var/www/ultra-api
tar -xzf /tmp/ultra-api.tar.gz -C .
chmod +x deploy/vps/*.sh
bash deploy/vps/setup-server.sh
bash deploy/vps/deploy-remote.sh
```

## HTTPS (Certbot)

Se já existir certificado para `app.misterodonto.com.br`, após trocar o Nginx para proxy:

```bash
certbot --nginx -d app.misterodonto.com.br
nginx -t && systemctl reload nginx
```

## Validar deploy

```bash
curl "http://127.0.0.1:3000/api/health"
curl "https://app.misterodonto.com.br/api/webhook/whatsapp/meta?hub.mode=subscribe&hub.verify_token=misterhubcrm_webhook_2026&hub.challenge=ok"
```

A segunda URL deve retornar **apenas** `ok` (texto), não HTML do checklist.

## Meta — Webhook

1. URL: `https://app.misterodonto.com.br/api/webhook/whatsapp/meta`
2. Token: `misterhubcrm_webhook_2026`
3. Assinar o campo **messages**
4. Se o app não estiver publicado, adicione `5522998836965` como número de teste

## Checklist embutido

O CRM continua servindo o checklist em `/checklist` (build automático no `npm run build`).
