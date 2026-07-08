# Continua o deploy na VPS (compativel com Windows OpenSSH)
# Uso: .\deploy\deploy-recover.ps1

$VPS_HOST = "187.127.39.197"
$VPS_USER = "root"
$REMOTE_PATH = "/var/www/ultra-api"
$SSH_KEY = $env:ULTRA_API_SSH_KEY

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Get-SshBaseArgs {
    $sshArgs = @(
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ServerAliveInterval=15",
        "-o", "ServerAliveCountMax=120",
        "-o", "TCPKeepAlive=yes"
    )
    if ($SSH_KEY -and (Test-Path $SSH_KEY)) {
        $sshArgs += @("-i", $SSH_KEY)
    }
    return $sshArgs
}

function Invoke-SshCommand {
    param([string]$RemoteCommand)
    $base = Get-SshBaseArgs
    & ssh @base ($VPS_USER + "@" + $VPS_HOST) $RemoteCommand
    if ($LASTEXITCODE -ne 0) {
        throw ("SSH falhou com codigo " + $LASTEXITCODE)
    }
}

function Invoke-ScpFile {
    param([string]$Source, [string]$Dest)
    $base = Get-SshBaseArgs
    & scp @base $Source $Dest
    if ($LASTEXITCODE -ne 0) {
        throw "SCP falhou"
    }
}

$webhookTestUrl = "https://app.captamo.com.br/api/webhook/whatsapp/meta?hub.mode=subscribe" + "&hub.verify_token=misterhubcrm_webhook_2026" + "&hub.challenge=ok"

Write-Host ("Recover deploy -> " + $VPS_USER + "@" + $VPS_HOST) -ForegroundColor Cyan
Write-Host "Senha SSH: ate 2 vezes (SCP + SSH)" -ForegroundColor DarkGray

if (-not (Test-Path ".env.local")) {
    Write-Host "ERRO: .env.local nao encontrado." -ForegroundColor Red
    exit 1
}

try {
    Write-Host "Verificando pacote remoto..." -ForegroundColor Cyan
    $base = Get-SshBaseArgs
    $remoteCheck = 'test -f /tmp/ultra-api-deploy.tar.gz && echo has_tar || echo no_tar'
    $check = & ssh @base ($VPS_USER + "@" + $VPS_HOST) $remoteCheck
    if ($LASTEXITCODE -ne 0) {
        throw "Nao foi possivel conectar por SSH"
    }

    $checkText = ($check | Out-String).Trim()
    if ($checkText -notmatch "has_tar") {
        Write-Host "Pacote nao encontrado em /tmp. Enviando codigo..." -ForegroundColor Yellow
        $tarFile = Join-Path $env:TEMP "ultra-api-deploy.tar.gz"
        if (Test-Path $tarFile) { Remove-Item $tarFile -Force }
        $excludeArgs = @("node_modules", ".next", ".git", ".cursor", "terminals") | ForEach-Object { "--exclude=" + $_ }
        & tar -czf $tarFile $excludeArgs -C $root .
        if ($LASTEXITCODE -ne 0) { throw "tar local falhou" }
        $scpDest = $VPS_USER + "@" + $VPS_HOST + ":/tmp/ultra-api-deploy.tar.gz"
        Invoke-ScpFile $tarFile $scpDest
        if (Test-Path $tarFile) { Remove-Item $tarFile -Force }
    }
    else {
        Write-Host "Pacote encontrado em /tmp (pulando SCP)." -ForegroundColor Green
    }

    Write-Host "Extraindo, configurando e fazendo build (aguarde alguns minutos)..." -ForegroundColor Cyan
    $remoteFinish = "bash -lc 'set -e; REMOTE_PATH=" + $REMOTE_PATH + "; mkdir -p `"$REMOTE_PATH`"; if [ -f /tmp/ultra-api-deploy.tar.gz ]; then tar -xzf /tmp/ultra-api-deploy.tar.gz -C `"$REMOTE_PATH`"; rm -f /tmp/ultra-api-deploy.tar.gz; fi; cd `"$REMOTE_PATH`"; if [ -f .env.local ] && [ ! -f .env.production ]; then cp .env.local .env.production; fi; if [ ! -f .env.production ]; then echo ERRO_env_ausente; exit 1; fi; chmod +x deploy/vps/*.sh; bash deploy/vps/setup-server.sh; bash deploy/vps/deploy-remote.sh'"
    Invoke-SshCommand $remoteFinish

    Write-Host ""
    Write-Host "Recover concluido." -ForegroundColor Green
    Write-Host ("Teste: " + $webhookTestUrl)
}
catch {
    Write-Host ("ERRO: " + $_.Exception.Message) -ForegroundColor Red
    Write-Host "Alternativa: terminal hPanel -> bash /var/www/ultra-api/deploy/vps/finish-on-server.sh" -ForegroundColor Yellow
    exit 1
}
