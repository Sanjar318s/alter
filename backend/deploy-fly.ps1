# Deploy ALTER API to Fly.io (run from backend/ after fly auth login + billing)
$ErrorActionPreference = "Stop"
$Fly = "$env:USERPROFILE\.fly\bin\flyctl.exe"

if (-not (Test-Path $Fly)) {
    Write-Error "Fly CLI not found. Install: iwr https://fly.io/install.ps1 -useb | iex"
}

& $Fly auth whoami | Out-Null
if ($LASTEXITCODE -ne 0) { & $Fly auth login }

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) { Write-Error "Missing .env with TURSO_* vars" }

$vars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $vars[$Matches[1]] = $Matches[2].Trim('"')
    }
}

$tursoUrl = $vars["TURSO_DATABASE_URL"]
$tursoToken = $vars["TURSO_AUTH_TOKEN"]
$jwt = $vars["JWT_SECRET"]
if ($jwt -eq "change-me-in-production" -or [string]::IsNullOrWhiteSpace($jwt)) {
    $jwt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
}

if (-not $tursoUrl -or -not $tursoToken) { Write-Error "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env" }

Set-Location $PSScriptRoot

& $Fly launch --yes --no-deploy --region sin --copy-config --ha=false
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

@(
    "TURSO_DATABASE_URL=$tursoUrl",
    "TURSO_AUTH_TOKEN=$tursoToken",
    "JWT_SECRET=$jwt",
    "NODE_ENV=production"
) | & $Fly secrets import
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Fly deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Deployed. Health:" -ForegroundColor Green
& $Fly status
$app = (& $Fly config show --json | ConvertFrom-Json).name
Write-Host "URL: https://$app.fly.dev/api/health"
