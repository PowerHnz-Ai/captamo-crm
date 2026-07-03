# Script de deploy para VPS Hostinger
# Uso: .\deploy.ps1
#
# Configure abaixo o IP (ou hostname) e o usuário SSH da sua VPS

$VPS_HOST = "31.97.85.113"
$VPS_USER = "root"
$REMOTE_PATH = "/var/www/meu-checklist"

$LOCAL_FILES = @(
    "index.html",
    "auth.html",
    "app.js",
    "auth.js",
    "config.js",
    "firebase-init.js",
    "styles.css",
    "auth.css",
    "manifest.json",
    "sw.js",
    "firestore.rules",
    "generate-icons.html"
)

Write-Host "Deploy para $VPS_USER@$VPS_HOST`:$REMOTE_PATH" -ForegroundColor Cyan

if ($VPS_HOST -eq "SEU_IP_OU_DOMINIO") {
    Write-Host "ERRO: Edite deploy.ps1 e defina VPS_HOST com o IP ou dominio da sua VPS." -ForegroundColor Red
    exit 1
}

$dest = "${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Caminhos completos dos arquivos
$filesToSend = $LOCAL_FILES | ForEach-Object { Join-Path $scriptDir $_ } | Where-Object { Test-Path $_ }
$iconsPath = Join-Path $scriptDir "icons"

try {
    # Envio dos arquivos principais (destino deve ser o último argumento do scp)
    & scp ($filesToSend + $dest)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Falha no SCP. Verifique se a pasta existe na VPS: ssh $dest mkdir -p $REMOTE_PATH" -ForegroundColor Yellow
        exit 1
    }

    # Envio da pasta icons se existir
    if (Test-Path $iconsPath) {
        scp -r "$iconsPath" $dest
        Write-Host "Pasta icons enviada." -ForegroundColor Green
    }
    else {
        Write-Host "Pasta icons nao encontrada. Gere os icones com generate-icons.html se precisar." -ForegroundColor Yellow
    }

    # Envio da pasta assets (logo do app) — obrigatório para o logo aparecer no site
    $assetsPath = Join-Path $scriptDir "assets"
    if (Test-Path $assetsPath) {
        # Garante que a pasta assets existe na VPS antes do envio
        $remoteAssets = "${REMOTE_PATH}/assets"
        ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p `"$remoteAssets`""
        scp -r "${assetsPath}\*" "${VPS_USER}@${VPS_HOST}:${remoteAssets}/"
        Write-Host "Pasta assets (logo) enviada." -ForegroundColor Green
    }
    else {
        Write-Host "AVISO: Pasta assets nao encontrada. O logo nao aparecera no site. Crie a pasta assets e coloque logo.png dentro." -ForegroundColor Yellow
    }

    # Envio da pasta dist (CSS compilado do Tailwind)
    $distPath = Join-Path $scriptDir "dist"
    if (Test-Path $distPath) {
        $remoteDist = "${REMOTE_PATH}/dist"
        ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p `"$remoteDist`""
        scp -r "${distPath}\*" "${VPS_USER}@${VPS_HOST}:${remoteDist}/"
        Write-Host "Pasta dist (tailwind.css) enviada." -ForegroundColor Green
    }
    else {
        Write-Host "AVISO: Pasta dist nao encontrada. Execute npm run build:css antes do deploy." -ForegroundColor Yellow
    }

    # Corrige permissões na VPS para o Nginx poder servir assets e icons (evita 403 Forbidden)
    Write-Host "Ajustando permissoes na VPS (evita 403 em logo/icones)..." -ForegroundColor Cyan
    ssh "${VPS_USER}@${VPS_HOST}" "chown -R www-data:www-data $REMOTE_PATH && chmod -R 755 $REMOTE_PATH"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Permissoes ajustadas." -ForegroundColor Green
    }
    else {
        Write-Host "Se aparecer 403 em assets ou icons, na VPS execute: chown -R www-data:www-data $REMOTE_PATH" -ForegroundColor Yellow
    }

    Write-Host "Deploy concluido. Acesse: http://$VPS_HOST" -ForegroundColor Green
}
catch {
    Write-Host "Erro: $_" -ForegroundColor Red
    exit 1
}
