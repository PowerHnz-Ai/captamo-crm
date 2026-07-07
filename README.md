# CAPTAMO

**Captamo** é o CRM de WhatsApp multi-clínicas (contatos, conversas, templates, campanhas, funil, relatórios), com painel de plataforma para gestão das clínicas.

O hub (`/hub`) é o lançador de apps Captamo — hoje **API Captamo** (o CRM). O checklist operacional (`/checklist/*`, fonte em `task-checklist/`) é um produto avulso que roda separado no seu próprio servidor/Firebase.

## Arquitetura

```
/login (Captamo) → /hub
  → API Captamo: /, /contacts, /conversations, /templates, /campaigns, ...
  → /platform: painel da plataforma (super admin) — cadastro/gestão de clínicas
```

- **Firebase:** projeto `captamo-hub` (auth + Firestore/Storage; o antigo `checklist-de82b` ficou com o task checklist avulso)
- **Checklist:** fonte em `task-checklist/`, build para `public/checklist/` via `npm run build-checklist`
- **Campanhas:** fila `campaigns/{id}/jobs`, processador em `/api/campaigns/process` (cron com `CRON_SECRET`)
- **Provedores WhatsApp:** Meta, Wasender, Evolution (`lib/whatsapp/`)

## Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

O `predev` copia o checklist para `public/checklist/`.

## Rotas principais

| Área | Rotas |
|------|-------|
| Captamo | `/login`, `/hub` |
| API Captamo | `/`, `/contacts`, `/conversations`, `/templates`, `/campaigns`, `/funnel`, `/reports`, `/settings/*` |
| Plataforma | `/platform` |
| Checklist (avulso) | `/checklist/*` |
| Legado | `/operacional` → redirect para `/checklist/` |

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
