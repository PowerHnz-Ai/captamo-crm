# Runbook — Migração do CRM para VPS nova + Firebase novo

O CRM muda para uma **VPS nova**, com **domínio novo** e **projeto Firebase novo**
(clientes recomeçam do zero). O **task checklist** fica na VPS antiga
(31.97.85.113) com o Firebase atual (`checklist-de82b`) e herda o domínio
`app.misterodonto.com.br`.

**Regra de ouro do rollback:** até a Etapa G, o CRM antigo continua 100%
funcional no domínio antigo. Se algo der errado no novo, basta reapontar o
webhook da Meta de volta e seguir no antigo.

## Valores desta migração (preencher no dia)

| Campo | Valor |
|---|---|
| IP da VPS nova | `<PREENCHER>` |
| Domínio novo do CRM | `<PREENCHER>` |
| Projeto Firebase novo (ID) | `<PREENCHER>` |
| Código da empresa Mister Odonto no sistema novo | `<PREENCHER na Etapa E>` |

## Insumos necessários antes de começar

1. **VPS nova**: IP + acesso root (senha ou chave). Ubuntu 22/24.
2. **Domínio novo do CRM** + acesso ao DNS (dos dois domínios).
3. **Firebase novo**: projeto criado no plano **Blaze** (Storage exige),
   config do web app (apiKey, authDomain, projectId, storageBucket,
   messagingSenderId, appId) e **service account JSON** (Admin SDK).
4. Dados Meta da Mister Odonto (token permanente, phoneNumberId, WABA ID) —
   continuam os mesmos; só a URL do webhook muda.

---

## Etapa B — Firebase novo (console)

1. **Authentication** → ativar provedor **E-mail/senha**.
2. Authentication → Settings → **Authorized domains** → adicionar o domínio
   novo do CRM. *(Esquecer isso = login quebrado.)*
3. **Firestore** → criar banco (modo produção).
4. **Storage** → ativar (exige Blaze). Anotar o bucket — projetos novos usam
   o formato `<projeto>.firebasestorage.app`.
5. Project settings → **Web app** → registrar → anotar a config client.
6. Project settings → Service accounts → **Generate new private key** →
   valores `FIREBASE_*`.
7. Deploy das regras (na máquina local):
   ```bash
   # editar task-checklist/.firebaserc → projeto novo (Etapa C faz junto)
   cd task-checklist
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

## Etapa C — Código com os valores novos (máquina local)

1. `task-checklist/config.js`: trocar a config para o Firebase novo (o
   checklist embutido do CRM passa a gravar no projeto novo; a cópia do
   produto avulso na VPS antiga fica congelada com o projeto antigo — desejado).
2. `lib/firebase-config.ts` (~linha 10): `sharedFirebaseProjectId` = projeto novo.
3. `task-checklist/.firebaserc`: projeto novo.
4. Conferir que não sobrou literal do projeto antigo fora de docs:
   ```bash
   grep -rn "checklist-de82b" --include="*.ts" --include="*.js" --include="*.tsx" .
   ```
5. `npm run build` + commit ("Migração: Firebase novo no CRM e checklist embutido").

## Etapa D — VPS nova

1. Chave SSH dedicada + alias:
   ```powershell
   ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\ultra_api_vps2 -N '""'
   type $env:USERPROFILE\.ssh\ultra_api_vps2.pub | ssh root@<IP_NOVO> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
   # ~/.ssh/config: Host ultra-vps2 / HostName <IP_NOVO> / User root / IdentityFile ~/.ssh/ultra_api_vps2
   ```
2. DNS: apontar o domínio novo → IP da VPS nova (fazer cedo, propagação).
3. Enviar o código e rodar o setup:
   ```powershell
   tar -czf $env:TEMP\ultra-api.tar.gz --exclude=node_modules --exclude=.next --exclude=.git --exclude=".env*" --exclude=.qa .
   scp $env:TEMP\ultra-api.tar.gz ultra-vps2:/tmp/
   ssh ultra-vps2 "mkdir -p /var/www/ultra-api && tar -xzf /tmp/ultra-api.tar.gz -C /var/www/ultra-api && cd /var/www/ultra-api && find deploy scripts -name '*.sh' -exec sed -i 's/\r$//' {} + && chmod +x deploy/vps/*.sh"
   ssh ultra-vps2 "cd /var/www/ultra-api && DOMAIN=<DOMINIO_NOVO> bash deploy/vps/setup-server.sh"
   ```
   O setup instala Node 20, PM2, ffmpeg, nginx, **MariaDB** (imprime a
   `DATABASE_URL` gerada — **anotar**), **certbot** (emite o TLS se o DNS já
   propagou) e o **backup diário** (03:30, retenção 7 dias).
4. Criar `/var/www/ultra-api/.env.production` a partir de
   `.env.production.example`. Atenção:
   - `DATABASE_URL` = a impressa pelo setup.
   - **Gerar valores NOVOS**: `CREDENTIALS_ENCRYPTION_KEY`, `CRON_SECRET`,
     `CHECKLIST_INTEGRATION_API_KEY`, `WHATSAPP_VERIFY_TOKEN`.
     **Nunca reutilizar a CREDENTIALS_ENCRYPTION_KEY da VPS antiga.**
   - Firebase novo em `FIREBASE_*` e `NEXT_PUBLIC_FIREBASE_*` (bucket
     explícito no formato `.firebasestorage.app`).
   - `APP_URL=https://<DOMINIO_NOVO>`;
     `PLATFORM_ADMIN_EMAILS=mr.misterhub@gmail.com,admincaptamo@gmail.com`;
     `CRM_DEFAULT_COMPANY_ID` vazio por enquanto; `META_*` legadas vazias.
5. Deploy: `ssh ultra-vps2 "cd /var/www/ultra-api && bash deploy/vps/deploy-remote.sh"`
   — roda `prisma migrate deploy` (cria o schema), build, instala o cron de
   campanhas e sobe o PM2. Validar: `curl https://<DOMINIO_NOVO>/api/health`.

## Etapa E — Bootstrap dos dados no sistema novo

1. Na VPS nova: `cd /var/www/ultra-api && node scripts/bootstrap-platform-admin.mjs "<senha>"`
   (cria `admincaptamo@gmail.com`; o admin não precisa de empresa vinculada —
   após o login ele cai no **painel da plataforma** `/platform`).
2. Login no CRM novo → painel `/platform` → cadastrar **Mister Odonto**
   (empresa + gerente) → **anotar o código** gerado.
3. Definir a empresa padrão do webhook:
   ```bash
   # editar .env.production: CRM_DEFAULT_COMPANY_ID=<CODIGO_NOVO>
   pm2 restart ultra-api --update-env
   ```
4. No painel `/platform` → botão **WhatsApp** da Mister Odonto → cadastrar
   token/phoneNumberId/WABA atuais (o modal valida na Meta).

## Etapa F — Meta e testes fim-a-fim (fora do horário de uso)

1. Painel Meta (developers.facebook.com → app → WhatsApp → Configuration):
   - Callback URL: `https://<DOMINIO_NOVO>/api/webhook/whatsapp/meta`
   - Verify token: o `WHATSAPP_VERIFY_TOKEN` novo
   - "Verificar e salvar" (handshake GET) — campo **messages** assinado.
   - **A partir daqui o inbound chega só no CRM novo.**
2. Testes no CRM novo: login; SSE conectado (DevTools → Network → eventstream);
   envio real de texto; **inbound real** (mandar mensagem do celular); campanha
   de teste; upload de mídia (valida o Storage novo); criar + excluir uma
   empresa de teste.

## Etapa G — VPS antiga vira o servidor do checklist (só após F validado)

1. Históricos: dump final + cópia do env antigo (guardar local):
   ```bash
   ssh ultra-vps "mysqldump --single-transaction --quick --databases ultrahub | gzip > /root/ultrahub-final.sql.gz"
   scp ultra-vps:/root/ultrahub-final.sql.gz <PASTA_LOCAL_SEGURA>/
   scp ultra-vps:/var/www/ultra-api/.env.production <PASTA_LOCAL_SEGURA>/env-antigo.txt
   ```
2. Parar o CRM antigo (arquivos ficam ~30 dias como backup):
   ```bash
   ssh ultra-vps "pm2 stop ultra-api && pm2 save && rm -f /etc/cron.d/ultra-campaigns"
   ```
   (manter o cron de backup do MariaDB por 30 dias.)
3. Nginx da VPS antiga → servir o checklist estático em
   `app.misterodonto.com.br` (root `/var/www/ultra-api/public/checklist`,
   que tem a config do Firebase ANTIGO — conferir o `config.js` antes):
   ```nginx
   server {
       listen 80;
       server_name app.misterodonto.com.br;
       root /var/www/ultra-api/public/checklist;
       index index.html;
       location = / { return 302 /index.html; }
       # stub: o app.js chama /api/presence/* por caminho relativo
       location /api/ { return 204; }
   }
   ```
   `nginx -t && systemctl reload nginx` (ajustar também o server block 443 do
   certbot, que continua válido para o domínio).
4. Testar: login de um usuário checklist existente no domínio antigo, dados
   intactos.

## Etapa H — Validação final

- CRM novo: login, inbox em tempo real, envio/recebimento, campanha via cron,
  contatos paginados, tela Clientes, exclusão de empresa, backup agendado
  (`ls /var/backups/mariadb` no dia seguinte).
- Checklist antigo: login, tarefas, dados.
- Monitorar `pm2 logs ultra-api` na VPS nova por 24h.
- Atualizar memória/docs (IP, domínio, chaves novas) + commit final.

## Riscos e observações

- **Authorized domains** (B.2) é o erro mais comum — login quebra silenciosamente.
- O webhook da Meta é um por app: a troca da URL migra o inbound de uma vez.
- `admincaptamo@gmail.com` (novo) e `adminultrahub@gmail.com` (antigo) existem em Firebases diferentes com
  senhas independentes.
- Chaves de criptografia são por banco: a `CREDENTIALS_ENCRYPTION_KEY` nova
  nunca deve ser trocada depois que credenciais forem cadastradas (perde-se o
  acesso aos tokens salvos).
