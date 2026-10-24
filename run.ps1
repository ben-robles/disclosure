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

# Ollama check: the app also shows this in a banner, but say it here too.
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3 | Out-Null
    Write-Host "Ollama: running"
} catch {
    Write-Host "Ollama is not running. Start it from the Start menu, or run: ollama serve" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Open on this computer:  http://127.0.0.1:$Port"
if ($Lan) {
    $ips = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notmatch "^(127|169\.254)\." -and $_.PrefixOrigin -ne "WellKnown" }
    foreach ($ip in $ips) { Write-Host "Open on your phone:     http://$($ip.IPAddress):$Port" }
    Write-Host "If Windows Firewall asks, allow access on private networks."
}
Write-Host ""

& $python -m uvicorn app.main:create_app --factory --host $bindHost --port $Port
