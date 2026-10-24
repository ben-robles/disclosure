# Disclosure on Cloud Run GPU

This folder deploys Gemma 4 (`gemma4:e4b`) behind Ollama on a private Google Cloud Run service with one NVIDIA L4 GPU. The backend on your laptop keeps speaking the Ollama HTTP API. It reaches the service through `gcloud run services proxy`, selected only by `DISCLOSURE_OLLAMA_URL`. The service scales to zero when idle.

Ollama image pinned in `Dockerfile`: `ollama/ollama:0.40.10`.

## Prerequisites

- gcloud SDK installed and logged in (`gcloud auth login`).
- A project with billing enabled.
- Roles: `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/serviceusage.serviceUsageConsumer`, `roles/artifactregistry.admin`, `roles/cloudbuild.builds.editor`. Project owners have all of them.
- Cloud Run GPU quota: Nvidia L4 without zonal redundancy in `us-east4`, 3 units.

## Deploy

```powershell
.\cloud\deploy.ps1 -Project <id>
```

The build runs on Cloud Build, so Docker is not needed on the laptop. It takes 10 to 20 minutes because the 9.6 GB model is baked into the image. Running it again is safe.

## Connect the laptop

In a second terminal, leave this running:

```powershell
gcloud run services proxy disclosure-gemma --region us-east4 --port 9090
```

Then put these in `.env`:

```dotenv
DISCLOSURE_OLLAMA_URL=http://127.0.0.1:9090
DISCLOSURE_MODEL=gemma4:e4b
DISCLOSURE_WORKERS=4
```

Run `.\run.ps1`. It prints `Model server: hosted (http://127.0.0.1:9090)` when the proxy is up. Remove the URL line to go back to local Ollama.

## Demo day

A cold start loads the model and can take a minute or more. Keep one instance warm for the demo, then put it back:

```powershell
gcloud run services update disclosure-gemma --region us-east4 --min-instances 1
gcloud run services update disclosure-gemma --region us-east4 --min-instances 0
```

## Scaling

| Setting | Value |
|---|---|
| Concurrency per instance | 4 (`OLLAMA_NUM_PARALLEL`) |
| Max instances | 3 (default GPU quota) |
| Concurrent photos | 12 |

To go further: request more GPU quota, raise `-MaxInstances`, and raise `DISCLOSURE_WORKERS` to match.

## Cost

An L4 without zonal redundancy costs $0.0001867 per second, about $0.67 per hour, plus about $0.08 per hour for CPU and memory. `--max-instances 3` caps the service at about $2.25 per hour. Idle time costs nothing at `--min-instances 0`. Create billing alerts at $100, $200 and $300 in the console.

## Tear down

```powershell
gcloud run services delete disclosure-gemma --region us-east4
gcloud artifacts repositories delete disclosure --location us-east4
```

## Links

- Cloud Run GPU docs: https://cloud.google.com/run/docs/configuring/services/gpu
- Google tutorial, Ollama on Cloud Run: https://cloud.google.com/run/docs/tutorials/gpu-gemma-with-ollama
