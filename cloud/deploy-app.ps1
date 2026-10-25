# Builds the Disclosure web app on Cloud Build and deploys it to Cloud Run as a PUBLIC service.
# It calls the private model service (deploy.ps1) with its own service account, so the laptop and
# `gcloud run services proxy` are not needed. Run deploy.ps1 first.
# Cost cap: -MaxInstances 1 keeps the app at one small instance. The model service has its own cap.
# Safe to run twice.
param(
    [string]$Project = $env:GCP_PROJECT,
    [string]$Region = "us-east4",
    [string]$Service = "disclosure-app",
    [string]$ModelService = "disclosure-gemma",
    [string]$Model = "gemma4:e4b",
    [int]$MinInstances = 1,
    [int]$MaxInstances = 1,
    [int]$Workers = 4
)

$ErrorActionPreference = "Stop"
if (-not $Project) { throw "No project. Pass -Project <id> or set `$env:GCP_PROJECT." }
$root = Split-Path -Parent $PSScriptRoot

function Assert-Ok([string]$step) {
    if ($LASTEXITCODE -ne 0) { throw "Step failed: $step (exit code $LASTEXITCODE)" }
}

Write-Host "1/6 Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $Project
Assert-Ok "enable APIs"

Write-Host "2/6 Looking up the model service"
$modelUrl = gcloud run services describe $ModelService --region $Region --project $Project --format "value(status.url)"
Assert-Ok "describe $ModelService (run cloud\deploy.ps1 first)"
if (-not $modelUrl) { throw "Model service $ModelService has no URL. Run cloud\deploy.ps1 first." }

Write-Host "3/6 Checking service account"
$sa = "disclosure-app@$Project.iam.gserviceaccount.com"
$ErrorActionPreference = "Continue"
gcloud iam service-accounts describe $sa --project $Project *> $null
$saExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"
if (-not $saExists) {
    gcloud iam service-accounts create disclosure-app --display-name "Disclosure web app" --project $Project
    Assert-Ok "create service account"
}
# A new service account can take a few seconds to become visible to IAM, so retry.
$ErrorActionPreference = "Continue"
for ($try = 1; $try -le 6; $try++) {
    gcloud run services add-iam-policy-binding $ModelService --region $Region --project $Project `
        --member "serviceAccount:$sa" --role roles/run.invoker *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 10
}
$ErrorActionPreference = "Stop"
Assert-Ok "grant run.invoker on $ModelService"

$image = "$Region-docker.pkg.dev/$Project/disclosure/${Service}:latest"

Write-Host "4/6 Building image $image"
gcloud builds submit $root --tag $image --project $Project --timeout 900
Assert-Ok "Cloud Build"

Write-Host "5/6 Deploying $Service"
# No CPU throttling: photos are analysed in a background thread after the upload request returns.
gcloud run deploy $Service --image $image --project $Project --region $Region `
    --allow-unauthenticated --service-account $sa `
    --cpu 1 --memory 2Gi --no-cpu-throttling --timeout 300 --concurrency 40 `
    --min-instances $MinInstances --max-instances $MaxInstances `
    --set-env-vars "DISCLOSURE_OLLAMA_URL=$modelUrl,DISCLOSURE_OLLAMA_AUTH=cloudrun,DISCLOSURE_MODEL=$Model,DISCLOSURE_WORKERS=$Workers"
Assert-Ok "Cloud Run deploy"

Write-Host "6/6 Done"
$appUrl = gcloud run services describe $Service --region $Region --project $Project --format "value(status.url)"
Write-Host ""
Write-Host "Public app link:"
Write-Host "  $appUrl"
Write-Host "Anyone with the link can use it. Stop it with: gcloud run services delete $Service --region $Region"
