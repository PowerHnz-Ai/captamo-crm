# Meu Checklist

Checklist de tarefas diárias, semanais e mensais com calendário, autenticação e opções de personalização.

## Funcionalidades

- **Calendário** – Navegue pelos meses e visualize tarefas por dia
- **Tarefas** – Diárias, semanais, mensais ou em data específica
- **Cadastro e login** – Sistema de autenticação com Firebase
- **Opções estéticas** – Tema (claro/escuro/sistema), cor de destaque, tamanho da fonte
- **PWA instalável** – Instale no computador, Android e iOS

## Configuração

### 1. Firebase (para login e sincronização)

1. Crie um projeto em [Firebase Console](https://console.firebase.google.com)
2. Ative **Authentication** → Método de login: **E-mail/Senha**
3. Ative **Firestore Database** → Crie em modo de produção
4. Em **Regras do Firestore**, use o conteúdo de `firestore.rules`
5. Copie as credenciais do projeto em **Configurações do projeto** → **Seus apps**
6. Cole em `config.js` substituindo os valores de `SUA_API_KEY`, `SEU_PROJETO`, etc.

**Sem configurar o Firebase:** o app funciona offline com armazenamento local (sem login).

### 2. Ícones PWA (para instalação)

1. Abra `generate-icons.html` no navegador
2. Clique nos links para baixar `icon-192.png` e `icon-512.png`
3. Salve os arquivos na pasta `icons/`

### 3. Servir o app

O app precisa ser servido via HTTP/HTTPS (não funciona abrindo o arquivo diretamente).

**Opção A – Servidor local:**
```bash
npx serve .
```
Acesse `http://localhost:3000`

**Opção B – VPS Hostinger:** Siga o guia [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md) para hospedar na sua VPS.

**Opção C – Outras hospedagens:** Vercel, Netlify, Firebase Hosting, etc.

## Instalação como app

### Computador (Chrome/Edge)
1. Abra o app no navegador
2. Clique no ícone de instalação na barra de endereços ou em ⋮ → "Instalar app"

### Android
1. Abra o app no Chrome
2. Menu ⋮ → "Adicionar à tela inicial" ou "Instalar app"

### iOS
1. Abra o app no Safari
2. Compartilhar → "Adicionar à Tela de Início"

## Estrutura do projeto

```
task-checklist/
├── index.html      # App principal
├── auth.html       # Login e cadastro
├── app.js          # Lógica principal
├── auth.js         # Autenticação
├── config.js       # Configuração Firebase
├── firebase-init.js
├── styles.css
├── auth.css
├── manifest.json   # Config PWA
├── sw.js           # Service Worker
├── firestore.rules
├── generate-icons.html
└── icons/
```

## Publicação em lojas (opcional)

Para publicar nas lojas **Google Play** e **App Store**, use [Capacitor](https://capacitorjs.com) para empacotar o PWA como app nativo:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init "Meu Checklist" com.meuchecklist.app
npx cap add android
npx cap add ios
npx cap sync
```

Depois, abra o projeto no Android Studio ou Xcode para gerar o pacote final.
