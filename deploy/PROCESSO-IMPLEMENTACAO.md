# Processo de Implementação — Captamo CRM

Roteiro completo para colocar um cliente novo no ar, em 3 fases:
**(1) Configuração da conta e da API → (2) Onboarding → (3) Treinamento.**

Cada fase lista **o que pedir ao cliente** e **o que a Captamo faz**. Complementa o runbook
técnico `deploy/ONBOARDING-CLIENTE.md`.

---

## FASE 1 — Configuração da conta e da API

**Objetivo:** número oficial do cliente conectado ao app da Captamo, enviando E recebendo.
**Duração típica:** 2–7 dias (o gargalo é a verificação de empresa na Meta — inicie ANTES de tudo).

### 1.1 O que pedir ao cliente

| # | Item | Detalhe / por quê |
|---|------|-------------------|
| 1 | Nome da clínica | Como vai aparecer no CRM |
| 2 | Nome + e-mail do responsável | Vira a conta **Líder** (recebe e-mail de senha) |
| 3 | **Número exclusivo** | **Sem WhatsApp/WhatsApp Business instalado.** Se já usa, precisa excluir a conta no app (Configurações → Conta → Excluir conta) — avisar que o histórico do celular se perde. Fixo serve (verificação por ligação) |
| 4 | Acesso ao chip na hora | O número recebe **SMS ou ligação** de verificação — combinar horário com alguém segurando o chip |
| 5 | **Business Manager próprio** com **verificação de empresa** | business.facebook.com → Configurações → Central de segurança → Verificação. Exige **CNPJ**, razão social e site ou e-mail de domínio próprio. Demora dias — **é o primeiro passo de todos** |
| 6 | **WABA** criada com o número | Conta do WhatsApp Business dentro do Business Manager dele |
| 7 | **Método de pagamento** na WABA | Cartão/linha de crédito — quem paga as conversas à Meta é o cliente |
| 8 | **Compartilhar a WABA com a Captamo** | No Business Manager DELE: Configurações do negócio → Contas → Contas do WhatsApp → selecionar a WABA → **Compartilhar com parceiro** → informar o **Business ID da Captamo** → conceder **Controle total**. Guiar por chamada de vídeo |
| 9 | **WABA ID** e **Phone Number ID** | Copiados do WhatsApp Manager dele (você anota — vão na config do CRM) |
| 10 | Perfil comercial | **Nome de exibição** (deve corresponder ao negócio — a Meta aprova/reprova), **foto** (logo quadrada ~640×640), categoria (ex.: Serviços médicos e de saúde), descrição, endereço, site, e-mail |

> ⚠️ **Nunca pedir senha do Facebook.** Todo o processo é por compartilhamento de ativos — o
> admin do Business do cliente executa os cliques com a sua orientação.

### 1.2 O que a Captamo faz

1. **Cadastrar o cliente no CRM** — logar como platform admin em `app.captamo.com.br` (cai no
   `/platform`) → **Cadastrar nova clínica** → nome da empresa + nome/e-mail do responsável.
   O sistema gera o **código da empresa** (6 caracteres), cria a conta do Líder e dispara o
   **e-mail de definição de senha**.
2. **Gerar o token permanente** — no Business Manager da **Captamo**: Configurações →
   Usuários do sistema → `captamo-api` → **Adicionar ativos**: controle total ao **app da
   Captamo** e à **WABA do cliente** (aparece lá após o passo 8 acima) → **Gerar novo token**
   com escopos `whatsapp_business_messaging` + `whatsapp_business_management`, expiração
   **Nunca**. Salvar o token em local seguro (nunca em chat).
3. **Inscrever o app na WABA** (sem isso o CRM envia mas **não recebe**):
   ```bash
   curl -X POST "https://graph.facebook.com/v25.0/{WABA_ID}/subscribed_apps" \
     -H "Authorization: Bearer {TOKEN}"
   # conferir — o app Captamo deve aparecer:
   curl "https://graph.facebook.com/v25.0/{WABA_ID}/subscribed_apps" -H "Authorization: Bearer {TOKEN}"
   ```
4. **Configurar no CRM** — `/platform` → cliente → **WhatsApp** → preencher **Token**,
   **Phone Number ID** e **WABA ID** → salvar. O CRM valida na Graph API e grava a credencial
   **criptografada por empresa**. O `phone_number_id` roteia o inbound para a empresa certa e
   carimba a conexão da conversa.
5. **Validar ponta a ponta:**
   - **Envio:** mensagem de teste pelo CRM para um celular.
   - **Recebimento:** mandar um WhatsApp de um celular para o número da clínica → deve
     aparecer nas Conversas (contato criado automaticamente com o nome do perfil).
   - Se não receber: conferir o passo 3 (`subscribed_apps`) e os eventos de webhook.

> O **webhook do app** (Callback URL + verify token) é configuração única do app da Captama —
> não se repete por cliente.

### ✅ Critérios para encerrar a Fase 1
- [ ] Verificação de empresa do cliente aprovada na Meta
- [ ] Nome de exibição aprovado
- [ ] Envio funcionando (mensagem de teste entregue)
- [ ] Recebimento funcionando (mensagem do celular aparece nas Conversas)
- [ ] Método de pagamento ativo na WABA do cliente

---

## FASE 2 — Onboarding

**Objetivo:** quando a equipe logar no primeiro dia, o CRM já está organizado com os dados e o
jeito de trabalhar da clínica. **Duração típica:** 1–2 dias.

### 2.1 O que pedir ao cliente

| # | Item | Para quê |
|---|------|----------|
| 1 | **Quem é quem**: nome + e-mail de cada pessoa e o papel | **Atendente** (opera as conversas), **Supervisor/Líder** (tudo + disparos + gestão). Regra do produto: quem for treinada em disparos assume papel de Líder/Supervisor |
| 2 | **Base de contatos** (planilha/CSV) | Nome + telefone; se tiver, colunas extras (origem, mês de entrada, indicador…). Enviar o modelo de planilha do CRM |
| 3 | **Respostas prontas** que já usam | Saudação, valores, endereço, convênios, agendamento, pós-consulta — viram Respostas rápidas |
| 4 | **Etapas do funil** | Ex.: Novo lead → Em conversa → Agendado → Compareceu → Paciente. Personalizar no Funil |
| 5 | **Origens de captação** que usam | Meta, Google, Indicações, Eventos já vêm prontas; criar personalizadas se preciso |
| 6 | **Horário de funcionamento** | Alinhar expectativa: a atribuição automática distribui mesmo com todas offline — as mensagens ficam esperando atribuídas |
| 7 | Primeiro caso de uso de **template** | Ex.: confirmação de agendamento (Utilidade) — já sai da fase com 1 template aprovado |

### 2.2 O que a Captamo configura no CRM

1. **Equipe** — logado como o Líder (ou orientando-o): Configurações → Equipe → criar as
   **Atendentes** (papel Atendente) e o **Supervisor**; cada uma recebe e-mail de senha.
   - Papéis: **Atendente** vê só as próprias conversas + fila; **Supervisor = Líder** em
     poderes (todas as conversas, monitor, disparos, equipe, conexões).
2. **Importar contatos** — Contatos → Importar → planilha do cliente; escolher política de
   duplicados; conferir origem/tags após importar.
3. **Atribuição automática** — Configurações → Atribuição: ligar, escolher
   **Equilibrar por carga** (recomendado) ou **Rodízio**, marcar as atendentes elegíveis.
4. **Respostas rápidas** — cadastrar as mensagens prontas do cliente.
5. **Funil** — ajustar as etapas conforme o cliente.
6. **Template inicial** — criar (e enviar para aprovação da Meta) o template do caso de uso
   escolhido. Atenção ao **checkbox de categoria**: desmarcado, a Meta **reprova** se discordar
   da categoria (não publica em outra); marcado, ela ajusta sozinha.
7. **LGPD** — mostrar a **lista de Excluídos** (Contatos → aba Excluídos): a ação
   "Excluir da lista (LGPD)" tira a pessoa de qualquer disparo para sempre (mesmo reimportada).
   O opt-out automático já bloqueia quem responde SAIR/PARAR/REMOVER/CANCELAR.
8. **Perfis** — foto e nome de cada usuária (Configurações → Meu perfil); tema/cor em Aparência.

### ✅ Critérios para encerrar a Fase 2
- [ ] Todas as contas criadas e com senha definida (todo mundo logou ao menos 1×)
- [ ] Contatos importados e conferidos
- [ ] Atribuição automática configurada e testada (mensagem nova cai para uma atendente)
- [ ] Respostas rápidas e funil personalizados
- [ ] 1 template aprovado pela Meta

---

## FASE 3 — Treinamento

**Objetivo:** equipe autônoma. **Formato sugerido:** 2 sessões de ~1h + exercício prático +
acompanhamento no 7º dia.

### Sessão 1 — Operação (todas: Atendentes + Supervisor + Líder)

Ordem lógica (do dia a dia para o avançado):

1. **Login e perfil** — entrar, foto, nome, tema (Aparência).
2. **Conversas (o coração)** — receber e responder; enviar foto, documento e **áudio**;
   **respostas rápidas**; reagir; responder mensagem específica; marcar não lida; encerrar.
3. **Janela de 24h** ⚠️ conceito-chave — após 24h sem resposta do paciente, só se inicia
   contato com **template aprovado**; mostrar o aviso na tela e como disparar template dali.
4. **Atribuição na prática** — "Minhas" vs "Não atribuídas"; assumir, transferir (com
   comentário), liberar; a atribuição automática distribui as novas por equilíbrio.
5. **Contatos** — cadastrar, buscar, tags, observações; abrir conversa a partir do contato.
6. **Funil** — mover o lead pelas etapas.
7. **LGPD na ponta** — o que fazer quando o paciente pede para não receber mais: botão
   **Excluir da lista (LGPD)** no perfil do contato dentro da conversa.

**Exercício prático:** jornada completa de uma paciente fictícia — chega mensagem → atendente
responde com resposta rápida → agenda → move no funil → encerra.

### Sessão 2 — Gestão e disparos (só Supervisor + Líder)

1. **Equipe** — criar/editar contas, papéis (Atendente/Supervisor/Líder), redefinir senha.
   Política: quem é treinada em disparos sobe para Supervisor/Líder.
2. **Atribuição automática** — Equilibrar por carga vs Rodízio; atendentes elegíveis;
   limite de conversas abertas.
3. **Monitor** — ver todas as conversas; botão **Monitor** no chat (metadados: tempo de 1ª
   resposta, responsável, janela 24h) — usar para treinar as atendentes.
4. **Relatórios** — enviadas/entregues/lidas/falhas, limite diário, opt-outs.
5. **Templates** — criar, variáveis com exemplos, categorias (Utilidade/Marketing/Autenticação),
   checkbox de categoria, ciclo de aprovação da Meta (aprovado/reprovado + motivo).
6. **Listas e origens** — segmentar quem vai receber; campos por origem (ex.: Indicador).
7. **Campanhas (disparos)** — passo a passo: escolher template → audiência (lista/tags/origem)
   → **exclusões** (recentes, tags, classes; excluídos LGPD ficam fora sempre) → **teste com 1
   número** → agendar → acompanhar status. Boas práticas: começar pequeno (o limite diário da
   Meta cresce com a qualidade), respeitar horário comercial, monitorar opt-out.

**Exercício prático:** disparo real de teste para os celulares da própria equipe.

### Regras de ouro (repetir sempre)
1. **Janela de 24h**: fora dela, só template aprovado.
2. **Opt-out é sagrado**: SAIR bloqueia automaticamente; pedido verbal → Excluir da lista (LGPD).
3. **Número oficial não vai no celular**: toda a operação é pelo CRM.
4. **Categoria de template errada = reprovação** (se o checkbox estiver desmarcado).
5. **Qualidade > volume**: reclamações derrubam o rating do número na Meta.

### Acompanhamento (D+7)
- Rever juntos os **Relatórios** da primeira semana (respondidas, tempo de 1ª resposta, opt-outs).
- Ajustar atribuição/funil conforme o uso real.
- Coletar dúvidas acumuladas e reforçar o que travou.

---

## Linha do tempo resumida

| Dia | O quê |
|-----|-------|
| D0 | Contrato fechado → enviar checklist da Fase 1 + cliente inicia **verificação de empresa** na Meta |
| D1–D5 | Meta aprova verificação → WABA + pagamento + compartilhamento → token + subscribed_apps + config no /platform → **testes de envio/recebimento** |
| D5–D6 | Onboarding: contas, contatos, atribuição, respostas rápidas, funil, 1º template |
| D6–D7 | Treinamento: Sessão 1 (operação) + Sessão 2 (gestão/disparos) |
| D+14 | Acompanhamento: relatórios, ajustes, dúvidas |
