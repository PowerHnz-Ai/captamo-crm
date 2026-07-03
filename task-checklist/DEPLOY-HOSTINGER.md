# Hospedar o app na VPS Hostinger

Este guia explica como colocar o **Meu Checklist** no ar em uma VPS da Hostinger (Linux).

## Pré-requisitos

- VPS Hostinger ativa (acesso SSH)
- Domínio apontando para o IP da VPS (opcional; pode usar só o IP)

---

## 1. Conectar na VPS

No seu computador (PowerShell ou terminal):

```bash
ssh root@SEU_IP_DA_VPS
```

(Substitua `SEU_IP_DA_VPS` pelo IP que a Hostinger informou.)

---

## 2. Instalar Nginx na VPS

```bash
# Ubuntu/Debian
apt update
apt install nginx -y

# Iniciar e habilitar
systemctl start nginx
systemctl enable nginx
```

Teste: abra `http://SEU_IP_DA_VPS` no navegador. Deve aparecer a página padrão do Nginx.

---

## 3. Criar pasta do app

```bash
mkdir -p /var/www/meu-checklist
```

---

## 4. Enviar os arquivos do app para a VPS

**No seu computador Windows** (na pasta do projeto, ex: `C:\Users\Power\task-checklist`):

### Opção A – Usando SCP (PowerShell)

```powershell
scp -r index.html auth.html app.js auth.js config.js firebase-init.js styles.css auth.css manifest.json sw.js firestore.rules generate-icons.html dist icons (se existir) root@SEU_IP_DA_VPS:/var/www/meu-checklist/
```

### Opção B – Usando o script de deploy

No PowerShell, na pasta do projeto:

```powershell
.\deploy.ps1
```

(Configure antes o IP e o usuário dentro do `deploy.ps1`.)

### Opção C – FTP/SFTP (FileZilla, WinSCP)

1. Conecte na VPS por SFTP (mesmo usuário/senha do SSH).
2. Envie todo o conteúdo da pasta `task-checklist` para `/var/www/meu-checklist/` na VPS.

Arquivos que precisam estar na VPS:

- `index.html`, `auth.html`
- `app.js`, `auth.js`, `config.js`, `firebase-init.js`
- `styles.css`, `auth.css`
- `dist/tailwind.css` (gerado por `npm run build:css`)
- `manifest.json`, `sw.js`
- `firestore.rules` (só para referência; o Firebase usa as regras no console)
- Pasta `icons/` (com `icon-192.png` e `icon-512.png`)

---

## 5. Configurar o Nginx para o app

Na VPS:

```bash
nano /etc/nginx/sites-available/meu-checklist
```

Cole o conteúdo abaixo (e troque `SEU_DOMINIO_OU_IP` pelo seu domínio ou pelo IP da VPS):

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO_OU_IP;
    root /var/www/meu-checklist;
    index index.html;

    location = /auth {
        try_files /auth.html =404;
    }

    location = /auth/ {
        try_files /auth.html =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css)$ {
        expires -1;
        add_header Cache-Control "no-cache";
    }

    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
}
```

Salve (Ctrl+O, Enter) e saia (Ctrl+X).

Ative o site e recarregue o Nginx:

```bash
ln -sf /etc/nginx/sites-available/meu-checklist /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Acesse no navegador: `http://SEU_DOMINIO_OU_IP`. O app deve abrir.

---

## 6. HTTPS com Let's Encrypt (recomendado)

Só use este passo se tiver um **domínio** apontando para o IP da VPS.

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d seu-dominio.com
```

Siga as perguntas (e-mail, aceitar termos). O Certbot ajusta o Nginx para HTTPS.

Depois, teste: `https://seu-dominio.com`

---

## 7. Ajustar permissões (obrigatório após deploy por SCP)

Se aparecer **403 Forbidden** ao carregar logo ou ícones, o Nginx não tem permissão para ler os arquivos. Na VPS, execute:

```bash
chown -R www-data:www-data /var/www/meu-checklist
chmod -R 755 /var/www/meu-checklist
```

O script `deploy.ps1` já faz isso automaticamente ao final do deploy (pede senha SSH mais uma vez).

---

## Resumo rápido

| Etapa              | Onde      | Ação |
|--------------------|-----------|------|
| Conectar           | Seu PC    | `ssh root@IP` |
| Instalar Nginx     | VPS       | `apt install nginx -y` |
| Criar pasta        | VPS       | `mkdir -p /var/www/meu-checklist` |
| Enviar arquivos    | Seu PC    | SCP, script ou SFTP → `/var/www/meu-checklist/` |
| Configurar Nginx   | VPS       | Criar site em `sites-available`, ativar e `reload` |
| HTTPS (com domínio)| VPS       | `certbot --nginx -d seu-dominio.com` |

---

## Atualizar o app depois

Sempre que alterar o projeto no seu PC, rode `.\deploy.ps1` de novo. O script envia os arquivos e **ajusta as permissões** na VPS (para evitar 403 em `assets/logo.png` e `icons/`). Não é necessário reiniciar o Nginx.

Se tiver dúvidas sobre painel da Hostinger ou onde pegar o IP/SSH, consulte a documentação da Hostinger para VPS.
