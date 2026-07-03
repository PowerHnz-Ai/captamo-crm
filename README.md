# ULTRA HUB

**ULTRA HUB** é o produto unificado da Mister Odonto com duas sessões:

- **Ultra API** — CRM WhatsApp (contatos, conversas, templates, campanhas, funil, relatórios)
- **Ultra Operacional** — Checklist de tarefas (agenda, pronta entrega, equipe)

## Arquitetura

```
/login (ULTRA HUB) → /hub
  → Ultra API: /, /contacts, /conversations, /templates, /campaigns, ...
  → Ultra Operacional: /checklist/* (app vanilla full-page, mesmo Firebase)
```

- **Firebase:** projeto `checklist-de82b` (auth + Firestore compartilhado)
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
| ULTRA HUB | `/login`, `/hub` |
| Ultra API | `/`, `/contacts`, `/conversations`, `/templates`, `/campaigns`, `/funnel`, `/reports`, `/settings/*` |
| Ultra Operacional | `/checklist/*` |
| Legado | `/operacional` → redirect para `/checklist/` |

## Disparos (campanhas)

- Templates **aprovados** pela Meta obrigatórios
- Preview de audiência e envio teste na UI
- Agendamento via `scheduledAt`
- Webhook atualiza `CampaignJob.messageStatus`
- Retry com backoff e throttling intra-lote
- Opt-out cancela jobs pendentes do contato

## Cron de campanhas

Configure um job externo (ex.: Vercel Cron) para:

```http
POST /api/campaigns/process
Authorization: Bearer <CRON_SECRET>
```

## Índices Firestore

Deploy com `firestore.indexes.json` (conversas por `companyId` + `lastMessageAt`).
