# Run on the Windows demo laptop, with the Ollama tray application fully quit.
# python -m venv .venv; .\.venv\Scripts\python -m pip install -r requirements.txt
# .\scripts\gate0_windows.ps1
param([ValidateSet("gemma4:e2b", "gemma4:e4b")][string]$Model = "gemma4:e2b")

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
if ($env:OS -ne "Windows_NT") { throw "Run this script on the Windows demo laptop." }
$python = Join-Path (Get-Location) ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "Create .venv and install requirements.txt first (see docs/gate0.md)." }
& $python -c "import sys; assert sys.version_info >= (3, 11), 'Python 3.11+ required'; import PIL"
if ($LASTEXITCODE -ne 0) { throw "Python 3.11+ and project dependencies are required." }
$ollama = (Get-Command ollama -ErrorAction Stop).Source
# Refuse to stop another app's server. Only processes started below are stopped.
if (Get-Process -Name "ollama*" -ErrorAction SilentlyContinue) {
    throw "Quit Ollama from its tray menu and stop any existing ollama serve, then rerun. This script manages its own server."
}
if (Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue) {
    throw "Port 11434 is occupied. Close the existing local server before running Gate 0."
}
$stamp = Get-Date -Format "yyyyMMddTHHmmssfff"
$output = Join-Path (Get-Location) "data\gate0\$stamp"
New-Item -ItemType Directory -Path $output -Force | Out-Null
$osInfo = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$drive = Get-PSDrive -Name ((Get-Location).Drive.Name)
$modelPath = if ($env:OLLAMA_MODELS) { $env:OLLAMA_MODELS } else { Join-Path $env:USERPROFILE ".ollama\models" }
$modelFree = $null
try {
    $modelDrive = [System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($modelPath)))
    $modelFree = $modelDrive.AvailableFreeSpace
} catch { Write-Warning "Could not measure model-drive free space; record it manually." }
$gpu = @(Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, AdapterRAM)
$nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
$nvidiaInfo = if ($nvidia) { (& $nvidia.Source --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>&1 | Out-String).Trim() } else { "No nvidia-smi; GPU details are in video_controllers." }
$ollamaVersion = (& $python -c "import subprocess,sys; p=subprocess.run([sys.argv[1], '--version'],capture_output=True,text=True); print((p.stdout+p.stderr).strip())" $ollama | Out-String).Trim()
$environment = [ordered]@{
    run_id = $stamp
    machine = $env:COMPUTERNAME
    windows = $osInfo.Caption
    windows_version = $osInfo.Version
    windows_build = $osInfo.BuildNumber
    ram_bytes = $computer.TotalPhysicalMemory
    video_controllers = $gpu
    nvidia = $nvidiaInfo
    python = (& $python --version | Out-String).Trim()
    git = (& git --version | Out-String).Trim()
    ollama_client = $ollamaVersion
    drive = $drive.Name
    free_disk_bytes = $drive.Free
    model_directory = $modelPath
    model_drive_free_bytes = $modelFree
    recorded_at = (Get-Date).ToUniversalTime().ToString("o")
}
$envPath = Join-Path $output "environment.json"
$environment | ConvertTo-Json -Depth 8 | Set-Content -Path $envPath -Encoding UTF8

$managedNames = @("OLLAMA_HOST", "OLLAMA_NUM_PARALLEL", "OLLAMA_MAX_LOADED_MODELS", "OLLAMA_NO_CLOUD", "DISCLOSURE_WORKERS", "DISCLOSURE_KEEP_ALIVE")
$saved = @{}
foreach ($name in $managedNames) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }
$server = $null
$sampler = $null
$exitCode = 1
try {
    $env:OLLAMA_HOST = "127.0.0.1:11434"
    $env:OLLAMA_NO_CLOUD = "1"
    $env:OLLAMA_MAX_LOADED_MODELS = "1"
    $env:DISCLOSURE_KEEP_ALIVE = "30m"
    foreach ($workers in @(1, 4)) {
        $env:OLLAMA_NUM_PARALLEL = [string]$workers
        $env:DISCLOSURE_WORKERS = [string]$workers
        $server = Start-Process -FilePath $ollama -ArgumentList "serve" -PassThru -NoNewWindow `
            -RedirectStandardOutput (Join-Path $output "server-$workers.stdout.log") `
            -RedirectStandardError (Join-Path $output "server-$workers.stderr.log")
        $ready = $false
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            $server.Refresh()
            if ($server.HasExited) { throw "Managed Ollama server exited; inspect server-$workers.stderr.log." }
            try {
                Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/version" -TimeoutSec 1 | Out-Null
                $ready = $true
                break
            } catch { Start-Sleep -Milliseconds 500 }
        }
        if (-not $ready) { throw "Managed Ollama server did not become ready." }
        if ($workers -eq 1) {
            & $ollama pull $Model
            if ($LASTEXITCODE -ne 0) { throw "Model pull failed. Evidence directory: $output" }
            & $ollama show $Model | Tee-Object -FilePath (Join-Path $output "ollama-show.txt")
            if ($LASTEXITCODE -ne 0) { throw "ollama show failed." }
        }
        $samplePath = Join-Path $output "resources-$workers.jsonl"
        $sampler = Start-Job -ArgumentList $samplePath -ScriptBlock {
            param($path)
            while ($true) {
                $processes = @(Get-Process -Name "ollama*" -ErrorAction SilentlyContinue)
                $memory = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum
                $available = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory * 1024
                $nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
                $gpuSample = if ($nvidia) {
                    (& $nvidia.Source --query-gpu=memory.used,utilization.gpu --format=csv,noheader,nounits 2>&1 | Out-String).Trim()
                } else { $null }
                [ordered]@{ recorded_at = (Get-Date).ToUniversalTime().ToString("o");
                    ollama_working_set_bytes = $memory; system_available_bytes = $available;
                    nvidia_memory_mib_and_utilization_percent = $gpuSample } |
                    ConvertTo-Json -Compress | Add-Content -Path $path -Encoding UTF8
                Start-Sleep -Seconds 1
            }
        }
        & $python scripts\gate0_ollama.py $Model assets\test_photos\gate0_water_stain.jpg `
            --suite --other-photo assets\test_photos\gate0_chimney_spalling.jpg `
            --workers $workers --environment $envPath --output (Join-Path $output "workers-$workers.json")
        # Keep going after technical failures so both settings retain evidence.
        if ($LASTEXITCODE -ne 0) { Write-Warning "Worker setting $workers failed technical checks; see JSON evidence." }
        Stop-Job $sampler
        Receive-Job $sampler -ErrorAction Continue | Out-Null
        Remove-Job $sampler
        $sampler = $null
        # Kill only the process tree that this invocation started, including runners.
        & taskkill /PID $server.Id /T /F | Out-Null
        $server.WaitForExit()
        $server = $null
        Start-Sleep -Seconds 2
    }
    & $python scripts\gate0_ollama.py --compare (Join-Path $output "workers-1.json") `
        (Join-Path $output "workers-4.json") --output (Join-Path $output "comparison.json") `
        --report-dir $output
    $exitCode = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0) { Write-Warning "Gate 0 technical checks failed. Review evidence before trying gemma4:e4b." }
    Write-Host "Evidence and draft reports: $output"
    Write-Host "Gate 0 is not passed until a reviewer confirms image-specific replies and records the results in docs/gate0.md."
} finally {
    if ($sampler) { Stop-Job $sampler; Remove-Job $sampler -Force }
    if ($server) {
        $server.Refresh()
        if (-not $server.HasExited) { & taskkill /PID $server.Id /T /F | Out-Null }
    }
    foreach ($name in $managedNames) { [Environment]::SetEnvironmentVariable($name, $saved[$name], "Process") }
}
exit $exitCode
