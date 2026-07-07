# CAPTAMO

**Captamo** é o CRM de WhatsApp multi-clínicas (contatos, conversas, templates, campanhas, funil, relatórios), com painel de plataforma para gestão das clínicas.

O hub (`/hub`) é o lançador de apps Captamo — hoje **API Captamo** (o CRM). O checklist operacional (**Captamo Tasks**) é um produto **independente**, com repositório, deploy e domínio próprios; o CRM apenas encaminha para a URL externa dele (`NEXT_PUBLIC_TASK_CHECKLIST_URL`).

## Arquitetura

```
/login (Captamo) → /hub
  → API Captamo: /, /contacts, /conversations, /templates, /campaigns, ...
  → /platform: painel da plataforma (super admin) — cadastro/gestão de clínicas
```

- **Firebase:** projeto `captamo-hub` (auth + Firestore/Storage; o antigo `checklist-de82b` ficou com o Captamo Tasks avulso)
- **Captamo Tasks (checklist):** app externo, repositório próprio; o CRM encaminha via `NEXT_PUBLIC_TASK_CHECKLIST_URL`. Integração de confirmação de tarefas continua em `/api/integrations/checklist/confirm`
- **Campanhas:** fila `campaigns/{id}/jobs`, processador em `/api/campaigns/process` (cron com `CRON_SECRET`)
- **Provedores WhatsApp:** Meta, Wasender, Evolution (`lib/whatsapp/`)

## Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Rotas principais

| Área | Rotas |
|------|-------|
| Captamo | `/login`, `/hub` |
| API Captamo | `/`, `/contacts`, `/conversations`, `/templates`, `/campaigns`, `/funnel`, `/reports`, `/settings/*` |
| Plataforma | `/platform` |
| Captamo Tasks | app externo (`NEXT_PUBLIC_TASK_CHECKLIST_URL`) |
| Legado | `/operacional` → redirect para o Captamo Tasks externo |

## Disparos (campanhas)

- Templates **aprovados** pela Meta obrigatórios
- Preview de audiência e envio teste na UI
- Agendamento via `scheduledAt`
- Webhook atualiza `CampaignJob.messageStatus`
- Retry com backoff e throttling intra-lote
- Opt-out cancela jobs pendentes do contato

## Cron de campanhas

O deploy na VPS provisiona `/etc/cron.d/ultra-campaigns` automaticamente (a cada
minuto, usando o `CRON_SECRET` do `.env.production`). Em outros ambientes,
configure um job externo para:

```http
POST /api/campaigns/process
Authorization: Bearer <CRON_SECRET>
```

## Índices Firestore

Deploy com `firestore.indexes.json` (conversas por `companyId` + `lastMessageAt`).
