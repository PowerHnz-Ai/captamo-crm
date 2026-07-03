# Deploy quando SSH do Windows falha (Connection timed out)

O IP pode estar bloqueado temporariamente (fail2ban). Use o **hPanel da Hostinger**.

## Passo 1 — Terminal do hPanel

Hostinger → VPS → **Terminal** (ou Browser SSH)

Teste:
```bash
echo ok
cd /var/www/ultra-api && ls -la
```

## Passo 2 — Enviar o arquivo corrigido

**Gerenciador de arquivos** do hPanel → `/var/www/ultra-api/app/(app)/campaigns/`

Faça upload do arquivo do seu PC:
```
C:\Users\Power\Ultra API\app\(app)\campaigns\page.tsx
```

(substitua o arquivo existente)

## Passo 3 — Build na VPS

No terminal do hPanel:

```bash
cd /var/www/ultra-api
bash deploy/vps/rebuild-only.sh
```

Aguarde 5–15 minutos. Deve terminar com health check local.

## Passo 4 — Validar

No navegador (deve retornar só `ok`):

```
https://app.misterodonto.com.br/api/webhook/whatsapp/meta?hub.mode=subscribe&hub.verify_token=misterhubcrm_webhook_2026&hub.challenge=ok
```

## Se a pasta /var/www/ultra-api estiver vazia

No hPanel, envie um zip do projeto (sem `node_modules` e `.next`), extraia em `/var/www/ultra-api`, copie `.env.local` como `.env.production`, depois:

```bash
cd /var/www/ultra-api
bash deploy/vps/finish-on-server.sh
```

## Voltar a usar SSH do Windows (opcional)

Aguarde 30–60 min e teste:
```powershell
ssh root@31.97.85.113
```

Ou configure chave SSH para evitar bloqueios por senha errada.
