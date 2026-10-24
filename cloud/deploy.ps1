# Builds the Ollama + Gemma image on Cloud Build and deploys it to Cloud Run with one NVIDIA L4 GPU.
# The service is private (IAM only) and scales to zero. Cost cap: -MaxInstances limits how many
# GPUs can run at once, at about $0.75 per GPU-hour, so the default of 3 is about $2.25 per hour.
# Safe to run twice: the Artifact Registry repository is only created when it is missing.
param(
    [string]$Project = $env:GCP_PROJECT,
    [string]$Region = "us-east4",
    [string]$Service = "disclosure-gemma",
    [string]$Model = "gemma4:e4b",
    [int]$MinInstances = 0,
    [int]$MaxInstances = 3,
    [int]$Concurrency = 4
)

$ErrorActionPreference = "Stop"
if (-not $Project) { throw "No project. Pass -Project <id> or set `$env:GCP_PROJECT." }

function Assert-Ok([string]$step) {
    if ($LASTEXITCODE -ne 0) { throw "Step failed: $step (exit code $LASTEXITCODE)" }
}

Write-Host "1/5 Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $Project
Assert-Ok "enable APIs"

Write-Host "2/5 Checking Artifact Registry repository"
# A missing repository makes describe fail, which is expected, so relax error handling here.
$ErrorActionPreference = "Continue"
gcloud artifacts repositories describe disclosure --location $Region --project $Project *> $null
$repoExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"
if (-not $repoExists) {
    gcloud artifacts repositories create disclosure --repository-format docker --location $Region --project $Project
    Assert-Ok "create repository"
}

$tag = $Model -replace '[^a-z0-9]', '-'
$image = "$Region-docker.pkg.dev/$Project/disclosure/${Service}:$tag"

Write-Host "3/5 Building image $image (10 to 20 minutes, mostly the model download)"
$buildDir = $PSScriptRoot
if ($Model -ne "gemma4:e4b") {
    # --tag builds cannot pass build args, so change the Dockerfile default in a temporary copy.
    $buildDir = Join-Path $env:TEMP "disclosure-cloud"
    if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
    Copy-Item -Recurse $PSScriptRoot $buildDir
    $dockerfile = Join-Path $buildDir "Dockerfile"
    (Get-Content $dockerfile) -replace '^ARG MODEL=.*$', "ARG MODEL=$Model" | Set-Content $dockerfile
}
gcloud builds submit $buildDir --tag $image --project $Project --timeout 1800
Assert-Ok "Cloud Build"

Write-Host "4/5 Deploying $Service"
$ErrorActionPreference = "Continue"
$deployOutput = gcloud beta run deploy $Service --image $image --project $Project --region $Region `
    --gpu 1 --gpu-type nvidia-l4 --no-gpu-zonal-redundancy --cpu 8 --memory 32Gi --no-cpu-throttling `
    --no-allow-unauthenticated --timeout 300 --concurrency $Concurrency `
    --min-instances $MinInstances --max-instances $MaxInstances `
    --set-env-vars "OLLAMA_NUM_PARALLEL=$Concurrency,OLLAMA_HOST=0.0.0.0:8080,OLLAMA_KEEP_ALIVE=-1" `
    --startup-probe "tcpSocket.port=8080,initialDelaySeconds=10,failureThreshold=30,periodSeconds=10" 2>&1
$deployCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"
$deployOutput | ForEach-Object { Write-Host $_ }
if ($deployCode -ne 0) {
    if (($deployOutput | Out-String) -match "quota") {
        Write-Host "GPU quota not granted yet. Open the Cloud Run quotas page in the console, filter for Nvidia L4 without zonal redundancy in $Region, and request 3." -ForegroundColor Yellow
    }
    throw "Step failed: Cloud Run deploy (exit code $deployCode)"
}

Write-Host "5/5 Done"
Write-Host ""
Write-Host "Deployed. Next, in a second terminal keep this running:"
Write-Host "  gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"
Write-Host "Then set in .env:  DISCLOSURE_OLLAMA_URL=http://127.0.0.1:9090"
