# Disclosure on Cloud Run GPU

This folder deploys Gemma 4 (`gemma4:e4b`) behind Ollama on a private Google Cloud Run service with one NVIDIA L4 GPU. The backend on your laptop keeps speaking the Ollama HTTP API. It reaches the service through `gcloud run services proxy`, selected only by `DISCLOSURE_OLLAMA_URL`. The service scales to zero when idle.

Ollama image pinned in `Dockerfile`: `ollama/ollama:0.40.10`.

## Prerequisites

- gcloud SDK installed and logged in (`gcloud auth login`).
- A project with billing enabled.
- Roles: `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/serviceusage.serviceUsageConsumer`, `roles/artifactregistry.admin`, `roles/cloudbuild.builds.editor`. Project owners have all of them.
- Cloud Run GPU quota: Nvidia L4 without zonal redundancy in `us-east4`. A new project also has a regional limit of 20 vCPU and 40 GiB, which fits one instance (8 vCPU, 32 GiB); request more quota before raising `-MaxInstances`.

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

## Public web app (no laptop needed)

```powershell
.\cloud\deploy-app.ps1 -Project <id>
```

Deploy the model first. This builds the React front end (`frontend/`) and the Python API into one container, with `cloud/gateway.mjs` sending `/api/*` to Python and everything else to React. It deploys the container to Cloud Run as `disclosure-app` with a public URL (no login), and lets its own service account call the private model service. Redeploy after every front-end change. The old plain-HTML UI in `static/` is no longer served there. The script prints the link to share; it is the same link each time. The app keeps one instance (`-MaxInstances 1`) and loses sessions when that instance restarts. If `.env` has the `DISCLOSURE_SMTP_*` settings, the script stores the password in Secret Manager (`disclosure-smtp-password`) and passes the other settings as env vars, so "Email me a copy" works on the public link. Without them, email stays off. Remove the public link with `gcloud run services delete disclosure-app --region us-east4`.

If the model service is cold, the first photo can time out. Warm it before sharing the link (see Demo day).

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
| Max instances | 1 (regional CPU and memory quota on a new project) |
| Concurrent photos | 4 |

Measured: about 16 photos per minute at 4 workers. To go further: request more CPU, memory and GPU quota, raise `-MaxInstances`, and raise `DISCLOSURE_WORKERS` to match.

## Cost

An L4 without zonal redundancy costs $0.0001867 per second, about $0.67 per hour, plus about $0.08 per hour for CPU and memory. `--max-instances 1` caps the service at about $0.75 per hour; 3 instances would be about $2.25. Idle time costs nothing at `--min-instances 0`. Create billing alerts at $100, $200 and $300 in the console.

## Tear down

```powershell
gcloud run services delete disclosure-gemma --region us-east4
gcloud artifacts repositories delete disclosure --location us-east4
```

## Links

- Cloud Run GPU docs: https://cloud.google.com/run/docs/configuring/services/gpu
- Google tutorial, Ollama on Cloud Run: https://cloud.google.com/run/docs/tutorials/gpu-gemma-with-ollama
