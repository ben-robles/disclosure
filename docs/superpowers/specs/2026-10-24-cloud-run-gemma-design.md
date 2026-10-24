# Hosted Gemma inference on Cloud Run GPU

Date: October 24, 2026
Status: approved design, awaiting implementation plan

## Goal

Move photo analysis from Ollama on the demo laptop to Ollama on a Google Cloud Run
GPU service, so Disclosure can serve many sellers at once. Everything else (FastAPI
backend, SQLite queue, photo storage, PDF, frontend) stays where it is today. Local
Ollama remains a supported mode.

Driver: Disclosure is being positioned as a real multi-user product and is entering
the MLH "Best Open Source AI Project" track. Budget: $325 in Google Cloud credits,
hackathon timeline (hours, not days).

Not in scope for this spec: hosting the backend or frontend on Cloud Run, Postgres,
Cloud Storage for photos, accounts, Vertex AI Model-as-a-Service. Those are the
"how we scale further" story, not this weekend's work.

## Decisions already made

| Question | Decision | Reason |
|---|---|---|
| Serving runtime | Ollama in a container | Same HTTP API the app already speaks. `OllamaAnalyzer` request logic does not change. |
| Model | `gemma4:e4b` (fallback `gemma4:e2b`) | Fits one NVIDIA L4 (24 GB). 26B/31B need vLLM on RTX PRO 6000 at roughly 4x the cost. |
| GPU | NVIDIA L4, zonal redundancy off | $0.0001867 per GPU-second, about $0.67/hour. Default quota 3 per region, granted on first deploy. |
| Region | `us-east4` (N. Virginia) | Closest L4 region to the DC/Maryland/Virginia users. |
| Weights | Baked into the image at build time | Cold start becomes model load (tens of seconds), not a 9.6 GB pull (minutes). |
| Service auth | Private (`--no-allow-unauthenticated`) | The GPU endpoint is never public. Only an authenticated caller reaches it. |
| Laptop-to-cloud path | `gcloud run services proxy` | Zero code change, proxy refreshes identity tokens. Direct bearer-token path kept as an option. |
| Queue | Unchanged: SQLite rows on the backend | Already provides backpressure and survives restarts. |

## Architecture

```
phone browser ──HTTP──> FastAPI backend (laptop, 127.0.0.1:8000)
                          │  SQLite queue, N worker threads
                          ▼
                 gcloud run services proxy (laptop, 127.0.0.1:9090)
                          │  HTTPS + IAM identity token
                          ▼
            Cloud Run service "disclosure-gemma" (us-east4)
              ollama/ollama + gemma4:e4b baked in, 1x L4
              concurrency 4, max 3 instances, scale to zero
```

The backend still believes it is talking to local Ollama. The only visible change
is the value of `DISCLOSURE_OLLAMA_URL`.

## Components

### 1. `cloud/` directory (new)

- `cloud/Dockerfile`
  - `FROM ollama/ollama:<pinned tag>`. The tag is the current Ollama release on the
    day of the first build; it is written into the Dockerfile, never `latest`.
  - Build step starts `ollama serve` in the background, waits for the port, runs
    `ollama pull gemma4:e4b`, then stops the server. The weights land in
    `/root/.ollama` inside the image layer.
  - `ENV OLLAMA_HOST=0.0.0.0:8080 OLLAMA_KEEP_ALIVE=-1 OLLAMA_NUM_PARALLEL=4`
  - `ENTRYPOINT ["ollama", "serve"]`
- `cloud/deploy.ps1`
  - Parameters: `-Project`, `-Region` (default `us-east4`), `-Service` (default
    `disclosure-gemma`), `-Model` (default `gemma4:e4b`), `-MinInstances` (default 0),
    `-MaxInstances` (default 3), `-Concurrency` (default 4).
  - Steps, in order: enable `run.googleapis.com`, `cloudbuild.googleapis.com`,
    `artifactregistry.googleapis.com`; create the Artifact Registry repo if missing;
    `gcloud builds submit cloud/ --tag <registry>/disclosure-gemma:<model>`;
    `gcloud beta run deploy` with the flags below; print the proxy command.
  - Deploy flags:
    `--gpu 1 --gpu-type nvidia-l4 --no-gpu-zonal-redundancy --cpu 8 --memory 32Gi
    --no-cpu-throttling --no-allow-unauthenticated --timeout 300
    --concurrency <Concurrency> --min-instances <Min> --max-instances <Max>
    --set-env-vars OLLAMA_NUM_PARALLEL=<Concurrency>
    --startup-probe tcpSocket.port=8080,initialDelaySeconds=10,failureThreshold=30,periodSeconds=10`
  - `--concurrency` and `OLLAMA_NUM_PARALLEL` are always set from the same parameter
    so they cannot drift.
- `cloud/README.md`
  - Prerequisites (gcloud SDK installed, project with billing, roles
    `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/serviceusage.serviceUsageConsumer`,
    `roles/artifactregistry.admin`, `roles/cloudbuild.builds.editor`).
  - How to deploy, how to start the proxy, how to point the backend at it, how to
    set `--min-instances 1` for demo day and back to 0 afterward, how to tear down.
  - Cost table and the three billing alerts ($100, $200, $300).

### 2. Backend changes (`app/`)

- `app/config.py`
  - New `OLLAMA_TOKEN = os.environ.get("DISCLOSURE_OLLAMA_TOKEN", "")`.
  - New derived flag `OLLAMA_IS_LOCAL`: true when the host of `OLLAMA_URL` is
    `127.0.0.1` or `localhost` **and** the port is `11434`. The proxy on port 9090 is
    therefore treated as remote for messaging purposes.
- `app/inference/ollama_analyzer.py`
  - `_request` adds `Authorization: Bearer <token>` when `config.OLLAMA_TOKEN` is
    non-empty. Nothing else in the request changes.
  - `status()` messages depend on `OLLAMA_IS_LOCAL`:
    - local, unreachable: today's text, fix `ollama serve`.
    - remote, unreachable: "The hosted AI model server is not reachable.", fix
      `gcloud run services proxy disclosure-gemma --region us-east4 --port 9090`.
    - model missing: today's text in both modes (the image is wrong, redeploy).
- `app/queue.py`: no change. `DISCLOSURE_WORKERS` is documented to be set to
  `Concurrency x expected instances` (4 for one instance, 12 at the quota ceiling).
- `run.ps1`
  - Health check reads `DISCLOSURE_OLLAMA_URL` from `.env` (falls back to
    `http://127.0.0.1:11434`) and probes `<url>/api/tags`.
  - Prints `Model server: local Ollama` or `Model server: hosted (via proxy at <url>)`.
  - If the URL is remote and unreachable, prints the proxy command instead of
    `ollama serve`.
- `.env.example`: add a commented block for `DISCLOSURE_OLLAMA_URL`,
  `DISCLOSURE_OLLAMA_TOKEN`, `DISCLOSURE_MODEL=gemma4:e4b`, `DISCLOSURE_WORKERS=4`.

### 3. Scripts

- `scripts/gate0_ollama.py`: `BASE_URL` reads `DISCLOSURE_OLLAMA_URL` with the
  current default. Everything else unchanged, so the same Gate 0 evidence can be
  collected against the hosted endpoint.
- `scripts/run_test_set.py`: unchanged; it already goes through the analyzer.

### 4. Honesty: docs and in-app copy

The product claim changes from "nothing leaves your computer" to "photos are sent
encrypted to our GPU server on Google Cloud, analyzed, and not stored there".
Local Ollama remains a documented mode for users who want it.

Files to update, with the replacement claim:

- `README.md` intro, Privacy section, and the architecture description.
- `frontend/src/routes/about.tsx` (line 38 today), `faq.tsx` (line 32),
  `index.tsx` (line 134 badge), `privacy.tsx` (lines 19 and 31).
- `static/index.html` (line 25).
- `frontend/src/lib/disclosure/analyzer.ts` (line 111): "The AI model server is not
  reachable."
- `PLAN.md` lines 35 and 257: add a dated amendment paragraph under each stating
  that hosted inference on Google Cloud Run is now allowed and why. Do not rewrite
  history.
- `Disclosure hackathon plan and gaps.md` row 15: "Best Use of Google Cloud" changes
  from "No" to "Possible; inference is hosted on Cloud Run GPU."
- `docs/decisions.md`: new entry recording this decision and the cost figures.

Exact copy for the privacy claim (use verbatim in the frontend and README):

> Your photos are stripped of location and device data on this computer, then sent
> over an encrypted connection to our AI server on Google Cloud, which looks at them
> and sends back a finding. The server does not keep your photos. Everything else
> stays on this computer until you choose to email yourself the report.

### 5. Tests

- `tests/test_no_network.py`: unchanged in intent. Code still may not contain any
  hardcoded URL other than `127.0.0.1`/`localhost`. The hosted URL arrives only via
  environment. Add `cloud/` to the scanned folders and `.ps1` to the scanned suffixes,
  plus the extensionless `cloud/Dockerfile`, so a hardcoded service URL in the deploy
  script or image would fail the test. Consequence: `deploy.ps1` must not print any
  `https://` link; it names console pages in words ("Cloud Run quotas page").
  Markdown is not scanned today and stays unscanned, so `cloud/README.md` may link
  to Google docs.
- `tests/test_ollama_analyzer.py`: two new cases. With `DISCLOSURE_OLLAMA_TOKEN`
  set, the request carries `Authorization: Bearer <token>`. With it unset, no
  `Authorization` header is sent.
- New `tests/test_config.py` (or extend an existing one): `OLLAMA_IS_LOCAL` is true
  for `http://127.0.0.1:11434`, false for `http://127.0.0.1:9090` and for an
  `https://...run.app` URL.
- `run.ps1` is not unit tested; it is verified by hand in the checklist below.

## Scaling model

| Lever | Value tonight | Ceiling without a quota request |
|---|---|---|
| Concurrent photos per instance | 4 (`--concurrency 4`, `OLLAMA_NUM_PARALLEL=4`) | Tune after measuring; up to 8 on L4 with E4B is plausible |
| Instances per region | 0 to 3 | 3 L4 (default quota) |
| Concurrent photos per region | 12 | 12 |
| Next step | — | Quota increase, second region, or RTX PRO 6000 at concurrency 16 |

Cost guard: `--max-instances 3` caps GPU spend at about $2.25/hour. Billing budget
with alerts at $100, $200, $300 created once in the console (not scripted).

Expected cost of the hackathon itself: build (one time, under $1), demo day with
`--min-instances 1` for 8 hours (about $6), testing (under $10). The remaining
credit is runway.

## Error handling

- Cold start: first request after idle waits for GPU attach plus model load. The
  backend's 120 s timeout (`DISCLOSURE_TIMEOUT_S`) covers it; if it does not, the
  finding becomes "Analysis timed out" with Retry, exactly as today. Demo day runs
  `--min-instances 1` so judges never see a cold start.
- Proxy not running: `status()` returns not ready with the proxy command as the fix;
  the banner shows it. Workers keep polling; pending photos are analyzed once the
  proxy is back.
- Quota or capacity error on deploy: `deploy.ps1` fails loudly and tells the user to
  open the Cloud Run quotas page in the console. Nothing in the app changes.
- Model pull failure at build: the Docker build fails; no image is pushed.

## Verification checklist

1. `cloud/deploy.ps1` completes; `gcloud run services describe disclosure-gemma`
   shows 1 GPU, concurrency 4, max 3.
2. Proxy running; `curl http://127.0.0.1:9090/api/tags` lists `gemma4:e4b`.
3. `scripts/gate0_ollama.py` against the proxy returns an image-specific description.
   Record cold and warm latency in `docs/gate0.md` under a new "Cloud Run" heading.
4. `.\run.ps1` prints `Model server: hosted`; banner is green; upload a photo; finding
   arrives.
5. `scripts/run_test_set.py` with `DISCLOSURE_WORKERS=4` on 8 photos. Record photos
   per minute next to the laptop figure. This is the scalability number for the pitch.
6. Stop the proxy; banner shows the proxy command; restart proxy; pending photo
   completes.
7. `pytest` passes, including `test_no_network.py`.
8. Fifteen minutes idle: Cloud Run metrics show instance count 0.

## Open items for the human

- Create or pick the GCP project and confirm billing is linked to the $325 credit.
- Install the gcloud SDK on the laptop (`gcloud` is not on PATH today).
- Create the billing budget alerts in the console.
- Confirm with an MLH organizer that hosted inference does not conflict with the
  Open Source AI track rules.
