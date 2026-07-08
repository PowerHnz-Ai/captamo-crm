# Onboarding de um cliente novo (clínica)

Processo completo para colocar uma clínica nova no ar no Captamo CRM. São dois lados:
**(A) CRM/Firebase** (cadastro da empresa e do gerente) e **(B) Meta/WhatsApp** (conectar o
número oficial da clínica ao app da Captamo — modelo **Tech Provider**).

---

## Resumo — o que coletar do cliente

Antes de começar, tenha em mãos:

| Item | De onde vem | Para quê |
|------|-------------|----------|
| Nome da empresa | Cliente | Cadastro no CRM |
| Nome + e-mail do gerente | Cliente | Conta de acesso ao CRM |
| **WABA ID** (WhatsApp Business Account ID) | WhatsApp Manager do cliente → Visão geral | Config no CRM |
| **Phone Number ID** do número | WhatsApp Manager do cliente | Config no CRM + roteamento do webhook |
| **Business ID da Captamo** | Business Manager da Captamo → Configurações → Informações da empresa | O cliente usa para compartilhar a WABA |

Pré-requisitos do lado do cliente: número **sem** WhatsApp comum/Business instalado; a WABA dele com
**método de pagamento** e **verificação de negócio** concluída no Business Manager dele.

---

## A. Cadastro no CRM (platform admin)

1. Logar como **platform admin** (e-mail em `PLATFORM_ADMIN_EMAILS`) em `app.captamo.com.br` → cai no
   painel **/platform**.
2. **Criar cliente**: informar **nome da empresa** + **nome e e-mail do gerente**.
   - O sistema (`createClientCompany`) gera um **código de empresa** de 6 caracteres, cria a conta
     Firebase do gerente (papel `gerente`) e dispara o **e-mail de definição de senha**.
3. O gerente define a senha pelo e-mail e já consegue entrar no CRM (ainda sem WhatsApp).

## B. Conectar o WhatsApp oficial (modelo Tech Provider)

O app é **da Captamo** (centralizado); a **WABA/número é do cliente**, no Business Manager dele. O
cliente **autoriza** o app da Captamo a operar a WABA.

1. **Cliente compartilha a WABA com a Captamo** — no **Business Manager do CLIENTE**:
   Configurações do negócio → Contas → **Contas do WhatsApp** → selecionar a WABA →
   **Compartilhar com um parceiro** → informar o **Business ID da Captamo** → conceder **Controle total**.
   (Alternativa: a Captamo solicita acesso à WABA pelo WABA ID e o cliente aprova.)

2. **Gerar o token permanente** — no **Business Manager da CAPTAMO**:
   Configurações → Usuários → **Usuários do sistema** → (criar/usar o `captamo-api`) → **Adicionar ativos**:
   dar **Controle total** ao **app da Captamo** e à **WABA do cliente** → **Gerar novo token** com os
   escopos `whatsapp_business_messaging` + `whatsapp_business_management`, expiração **Nunca**.

3. **Inscrever o app da Captamo nos webhooks da WABA** (senão o CRM **envia mas não recebe**):
   ```bash
   curl -X POST "https://graph.facebook.com/v25.0/{WABA_ID}/subscribed_apps" \
     -H "Authorization: Bearer {TOKEN}"
   # confira:
   curl "https://graph.facebook.com/v25.0/{WABA_ID}/subscribed_apps" -H "Authorization: Bearer {TOKEN}"
   ```
   O app `Captamo` deve aparecer na lista.

4. **Configurar no CRM** — `/platform` → cliente → **WhatsApp**: preencher **Token**, **Phone Number ID**
   e **WABA ID** → salvar. O CRM (`configureClientWhatsapp`) valida na Graph API e grava a credencial
   **criptografada por empresa** (`company_settings.api_key_secret`, AES-256-GCM). O `phone_number_id`
   é o que roteia o **inbound** para a empresa certa.

## C. Validar

- **Envio**: mandar uma mensagem de teste pelo CRM (ou template) para um número.
- **Recebimento**: mandar um WhatsApp de um celular para o número da clínica → deve aparecer nas
  conversas (registra em `webhook_events` = received/processed e em `messages`).

---

## Notas / escala

- **Webhook do app**: a Callback URL do app da Captamo aponta para
  `https://app.captamo.com.br/api/webhook/whatsapp/meta` com o verify token do `.env.production`.
  Isso é do **app** (uma vez só), não por cliente.
- **Cobrança**: cada WABA de cliente tem o próprio método de pagamento (o cliente paga a Meta), ou a
  Captamo monta uma linha de crédito compartilhada.
- **Onboarding self-service (futuro)**: implementar **Embedded Signup** (botão "Conectar WhatsApp") +
  **App Review / Acesso Avançado** dos escopos de WhatsApp — aí o cliente conecta a própria WABA sozinho,
  sem os passos manuais B1–B3.
