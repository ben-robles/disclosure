# One command: checks the local model server, starts the app, prints the URL.
#   .\run.ps1          -> http://127.0.0.1:8000  (this computer only)
#   .\run.ps1 -Lan     -> binds 0.0.0.0 so a phone on the same Wi-Fi can open it
param([switch]$Lan, [int]$Port = 8000)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
    & $python -m pip install -q -r requirements.txt
}

$bindHost = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }

# Model server check: the app also shows this in a banner, but say it here too.
# Local Ollama by default; .env can point DISCLOSURE_OLLAMA_URL at the Cloud Run proxy.
$modelUrl = "http://127.0.0.1:11434"
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*DISCLOSURE_OLLAMA_URL\s*=\s*(.+)$') {
            $modelUrl = $Matches[1].Trim().Trim('"', "'")
        }
    }
}
$isLocal = $modelUrl -match '^https?://(127\.0\.0\.1|localhost):11434/?$'
try {
    Invoke-RestMethod -Uri "$($modelUrl.TrimEnd('/'))/api/tags" -TimeoutSec 3 | Out-Null
    Write-Host ("Model server: " + $(if ($isLocal) { "local Ollama" } else { "hosted ($modelUrl)" }))
} catch {
    if ($isLocal) {
        Write-Host "Ollama is not running. Start it from the Start menu, or run: ollama serve" -ForegroundColor Yellow
    } else {
        Write-Host "Hosted model server not reachable. In another terminal run:" -ForegroundColor Yellow
        Write-Host "  gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"
    }
}

Write-Host ""
Write-Host "This port serves the API and the OLD plain-HTML page in static/. The current site is the React app:" -ForegroundColor Yellow
Write-Host "  cd frontend; npm run dev   ->  http://127.0.0.1:5173  (proxies /api to this port)" -ForegroundColor Yellow
Write-Host "Open on this computer:  http://127.0.0.1:$Port  (old page)"
if ($Lan) {
    $ips = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notmatch "^(127|169\.254)\." -and $_.PrefixOrigin -ne "WellKnown" }
    foreach ($ip in $ips) { Write-Host "Open on your phone:     http://$($ip.IPAddress):$Port" }
    Write-Host "If Windows Firewall asks, allow access on private networks."
}
Write-Host ""

& $python -m uvicorn app.main:create_app --factory --host $bindHost --port $Port
