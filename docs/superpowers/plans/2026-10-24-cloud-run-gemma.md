# Hosted Gemma on Cloud Run GPU Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Disclosure's Gemma photo analysis on a private Google Cloud Run GPU service instead of (or in addition to) Ollama on the laptop, with no change to the analyzer's request logic.

**Architecture:** An `ollama/ollama` container with `gemma4:e4b` weights baked in at build time runs on Cloud Run with one NVIDIA L4, private, scale-to-zero. The laptop backend keeps speaking the Ollama HTTP API; it reaches the service through `gcloud run services proxy` on `127.0.0.1:9090`, selected only by the `DISCLOSURE_OLLAMA_URL` environment variable. Config gains a local/hosted flag so status messages and `run.ps1` give the right fix command.

**Tech Stack:** Python 3.11 / FastAPI backend (unchanged deps), pytest, PowerShell 5.1, gcloud SDK, Cloud Build, Artifact Registry, Cloud Run GPU (L4), Ollama Docker image.

**Spec:** `docs/superpowers/specs/2026-10-24-cloud-run-gemma-design.md`

## Global Constraints

- Service name `disclosure-gemma`, region `us-east4`, model `gemma4:e4b`, proxy port `9090`. Use these exact values everywhere.
- Deploy flags: `--gpu 1 --gpu-type nvidia-l4 --no-gpu-zonal-redundancy --cpu 8 --memory 32Gi --no-cpu-throttling --no-allow-unauthenticated --timeout 300`, `--concurrency` equal to `OLLAMA_NUM_PARALLEL` (default 4), `--min-instances 0`, `--max-instances 3`.
- No hardcoded URL other than `127.0.0.1` / `localhost` in any `.py`, `.js`, `.html`, `.css`, `.ps1`, or `cloud/Dockerfile`. `tests/test_no_network.py` enforces this. `deploy.ps1` must not print `https://` links.
- `OLLAMA_IS_LOCAL` is true only for host `127.0.0.1`/`localhost` **and** port `11434`. The proxy on `9090` counts as hosted.
- Hosted-mode fix string, verbatim: `gcloud run services proxy disclosure-gemma --region us-east4 --port 9090`
- Privacy copy, verbatim wherever the spec lists a file: "Your photos are stripped of location and device data on this computer, then sent over an encrypted connection to our AI server on Google Cloud, which looks at them and sends back a finding. The server does not keep your photos. Everything else stays on this computer until you choose to email yourself the report."
- No new Python dependencies. No Docker on the laptop; images build on Cloud Build.
- Commit messages: plain, no co-author or tool footer.
- Human-only steps (gcloud install, `gcloud auth login`, choosing the project) are marked **HUMAN**. In a Claude Code session the human runs them by typing `! <command>` so output lands in the session.

## Review Focus

1. `DISCLOSURE_OLLAMA_URL` with a trailing slash or uppercase host (`http://LOCALHOST:11434/`): `is_local_url` must still return true. Test in Task 1.
2. `DISCLOSURE_OLLAMA_TOKEN` set to whitespace only: no `Authorization` header should be sent. Test in Task 2.
3. Proxy up but Cloud Run instance cold: first `/api/chat` can take 60 s or more. The analyzer's 120 s timeout must produce `timeout`, not `unavailable`, and the worker must retry the photo when the user presses Retry. Covered by existing `test_timeout_is_reported_not_raised`; verified end to end in Task 6 step 8.
4. `run.ps1` with no `.env` file at all: must fall back to `http://127.0.0.1:11434` and print `Model server: local Ollama`. Manual check in Task 5 step 7.
5. `deploy.ps1` run twice: second run must not fail on "repository already exists". Manual check in Task 6 step 3.

---

### Task 0: Workstation prerequisites (HUMAN with assistance)

**Files:** none

**Interfaces:**
- Produces: `$env:GCP_PROJECT` set in the shell for later tasks; `gcloud` on PATH and authenticated.

- [ ] **Step 1: HUMAN installs gcloud SDK**

Run in PowerShell (the human types `! ` first in Claude Code):
```powershell
winget install --id Google.CloudSDK -e
```
Open a new terminal afterward so PATH refreshes. Verify: `gcloud --version` prints a version line.

- [ ] **Step 2: HUMAN logs in**

```powershell
gcloud auth login
```
Expected: browser opens, then "You are now logged in as <email>".

- [ ] **Step 3: Find the project ID**

```powershell
gcloud projects list --format="table(projectId,name,projectNumber)"
```
The human picks the project whose billing account holds the $325 credit. Confirm with:
```powershell
gcloud billing projects describe <PROJECT_ID> --format="value(billingEnabled)"
```
Expected: `True`. If `False`, stop; the human links billing in the console before continuing.

- [ ] **Step 4: Set defaults**

```powershell
gcloud config set project <PROJECT_ID>
gcloud config set run/region us-east4
$env:GCP_PROJECT = "<PROJECT_ID>"
```

- [ ] **Step 5: Enable APIs**

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```
Expected: "Operation ... finished successfully."

No commit for this task.

---

### Task 1: Config: token and local/hosted flag

**Files:**
- Modify: `app/config.py`
- Create: `tests/test_config.py`

**Interfaces:**
- Produces: `config.OLLAMA_TOKEN: str` (default `""`), `config.is_local_url(url: str) -> bool`, `config.OLLAMA_IS_LOCAL: bool` (computed from `OLLAMA_URL`), `config.PROXY_FIX: str` (the verbatim hosted-mode fix string).

- [ ] **Step 1: Write failing tests**

```python
# tests/test_config.py
from app import config


def test_is_local_url_true_for_default_ollama():
    assert config.is_local_url("http://127.0.0.1:11434")
    assert config.is_local_url("http://localhost:11434/")
    assert config.is_local_url("http://LOCALHOST:11434")


def test_is_local_url_false_for_proxy_and_cloud():
    assert not config.is_local_url("http://127.0.0.1:9090")
    assert not config.is_local_url("https://disclosure-gemma-abc-uk.a.run.app")
    assert not config.is_local_url("http://192.168.1.5:11434")


def test_proxy_fix_string():
    assert config.PROXY_FIX == (
        "gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"
    )
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_config.py -v`
Expected: FAIL, `AttributeError: module 'app.config' has no attribute 'is_local_url'`

- [ ] **Step 3: Implement in `app/config.py`**

Add after the `OLLAMA_URL` line:
- `def is_local_url(url: str) -> bool` using `urllib.parse.urlsplit`; true when `hostname` lowercased is `127.0.0.1` or `localhost` and `port == 11434`.
- `OLLAMA_IS_LOCAL = is_local_url(OLLAMA_URL)`
- `OLLAMA_TOKEN = os.environ.get("DISCLOSURE_OLLAMA_TOKEN", "").strip()`
- `PROXY_FIX = "gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"`

Also update the comment above `OLLAMA_URL` to say the value may point at the Cloud Run proxy.

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_config.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/config.py tests/test_config.py
git commit -m "Add hosted-model config: token, local URL check, proxy fix string"
```

---

### Task 2: Analyzer: bearer header and hosted status messages

**Files:**
- Modify: `app/inference/ollama_analyzer.py` (`_request`, `status`)
- Modify: `tests/test_ollama_analyzer.py`

**Interfaces:**
- Consumes: `config.OLLAMA_TOKEN`, `config.is_local_url`, `config.PROXY_FIX` from Task 1.
- Produces: `OllamaAnalyzer.__init__(self, base_url=None, model=None, timeout_s=None, token=None)`; `token` defaults to `config.OLLAMA_TOKEN`. `status()` unchanged shape `{'ready', 'message', 'fix'}`.

- [ ] **Step 1: Write failing tests**

Append to `tests/test_ollama_analyzer.py`:

```python
def test_bearer_header_sent_when_token_set(stub):
    seen = {}

    def fn(h, body):
        seen["auth"] = h.headers.get("Authorization")
        reply(h, {"message": {"content": GOOD}})

    OllamaAnalyzer(stub(fn), "m", 5, token="abc123").analyze(b"x")
    assert seen["auth"] == "Bearer abc123"


def test_no_auth_header_when_token_empty_or_blank(stub):
    seen = {}

    def fn(h, body):
        seen["auth"] = h.headers.get("Authorization")
        reply(h, {"message": {"content": GOOD}})

    OllamaAnalyzer(stub(fn), "m", 5, token="").analyze(b"x")
    assert seen["auth"] is None
    OllamaAnalyzer(stub(fn), "m", 5, token="   ").analyze(b"x")
    assert seen["auth"] is None


def test_status_hosted_unreachable_points_at_proxy():
    # port 9 is not 11434, so this URL counts as hosted
    down = OllamaAnalyzer("http://127.0.0.1:9", "gemma-x").status()
    assert not down["ready"]
    assert down["message"] == "The hosted AI model server is not reachable."
    assert down["fix"] == "gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"
```

Then edit the existing `test_status_messages`: its first block uses `http://127.0.0.1:9`, which is now hosted. Change that block to:

```python
    down = OllamaAnalyzer("http://127.0.0.1:11434", "gemma-x").status()
    assert not down["ready"] and down["fix"] == "ollama serve"
```
If local Ollama happens to be running on the test machine this assertion is wrong. Before it, try `urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=1)`; on success call `pytest.skip("local Ollama is running")`.

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_ollama_analyzer.py -v`
Expected: the three new tests FAIL (`TypeError: unexpected keyword argument 'token'`); `test_status_messages` passes or skips.

- [ ] **Step 3: Implement**

In `OllamaAnalyzer.__init__`: add `token=None`; store `self.token = (config.OLLAMA_TOKEN if token is None else token).strip()`.

In `_request`: build `headers = {"Content-Type": "application/json"}`; if `self.token`, add `headers["Authorization"] = f"Bearer {self.token}"`.

In `status()` unreachable branch: if `config.is_local_url(self.base_url)` keep today's message and `"ollama serve"`; otherwise message `"The hosted AI model server is not reachable."` and fix `config.PROXY_FIX`. Model-missing branch unchanged.

Update the module docstring: "Only outbound call: the Ollama server named by DISCLOSURE_OLLAMA_URL (local Ollama or the Cloud Run proxy)."

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_ollama_analyzer.py tests/test_config.py -v`
Expected: all passed (one may be skipped).

- [ ] **Step 5: Commit**

```bash
git add app/inference/ollama_analyzer.py tests/test_ollama_analyzer.py
git commit -m "Send bearer token to Ollama when configured; hosted-mode status message"
```

---

### Task 3: Extend the no-network test to the cloud directory

**Files:**
- Modify: `tests/test_no_network.py`
- Create: `cloud/.gitkeep` (removed in Task 4)

**Interfaces:**
- Produces: the scanner covers folders `app`, `static`, `scripts`, `cloud` and the repo root `run.ps1`; suffixes `.py .js .html .css .ps1`; plus any file named `Dockerfile`.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_no_network.py`:

```python
def test_scanner_covers_cloud_and_powershell(tmp_path, monkeypatch):
    from tests import test_no_network as mod
    (tmp_path / "cloud").mkdir()
    (tmp_path / "cloud" / "deploy.ps1").write_text('Write-Host "https://evil.example"', encoding="utf-8")
    (tmp_path / "cloud" / "Dockerfile").write_text("FROM x\n# https://evil2.example\n", encoding="utf-8")
    for f in ("app", "static", "scripts"):
        (tmp_path / f).mkdir()
    monkeypatch.setattr(mod, "ROOT", tmp_path)
    offenders = mod.find_offenders()
    assert any("deploy.ps1" in o and "evil.example" in o for o in offenders)
    assert any("Dockerfile" in o and "evil2.example" in o for o in offenders)
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_no_network.py -v`
Expected: FAIL, `AttributeError: ... has no attribute 'find_offenders'`

- [ ] **Step 3: Refactor the scanner**

In `tests/test_no_network.py`:
- `FOLDERS = ("app", "static", "scripts", "cloud")`, `SUFFIXES = {".py", ".js", ".html", ".css", ".ps1"}`, `EXTRA_FILES = ("run.ps1",)`.
- `def find_offenders() -> list[str]`: iterate `ROOT / folder` for each folder that exists; include a file when its suffix is in `SUFFIXES` or its name is `Dockerfile`; also scan `ROOT / name` for each `EXTRA_FILES`. Return `"<relpath>: <url>"` strings as today.
- `test_no_external_urls_in_code` becomes `assert not find_offenders(), find_offenders()`.
- `run.ps1` contains `http://127.0.0.1:$Port`. Widen `ALLOWED` so the port part is `(:(\d+|\$\w+))?`, so a PowerShell variable in the port position is still a local URL.

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_no_network.py -v`
Expected: 2 passed. (If `run.ps1` fails because of the hardcoded `http://127.0.0.1:11434`, that URL is allowed; passing is expected.)

- [ ] **Step 5: Commit**

```bash
git add tests/test_no_network.py
git commit -m "No-network test scans cloud/ and PowerShell scripts"
```

---

### Task 4: Cloud artifacts: Dockerfile, deploy script, README

**Files:**
- Create: `cloud/Dockerfile`
- Create: `cloud/deploy.ps1`
- Create: `cloud/README.md`

**Interfaces:**
- Consumes: `$env:GCP_PROJECT` from Task 0.
- Produces: image `us-east4-docker.pkg.dev/<project>/disclosure/disclosure-gemma:e4b`; Cloud Run service `disclosure-gemma` in `us-east4`; `deploy.ps1` parameters `-Project -Region -Service -Model -MinInstances -MaxInstances -Concurrency`.

- [ ] **Step 1: Pin the Ollama image tag**

Look up the newest release tag on `hub.docker.com/r/ollama/ollama/tags` (a plain version like `0.14.3`, not `latest`). Record it in the Dockerfile `FROM` line and in `cloud/README.md`.

- [ ] **Step 2: Write `cloud/Dockerfile`**

```dockerfile
FROM ollama/ollama:<PINNED_TAG>
ARG MODEL=gemma4:e4b
ENV OLLAMA_HOST=0.0.0.0:8080 \
    OLLAMA_KEEP_ALIVE=-1 \
    OLLAMA_NUM_PARALLEL=4 \
    OLLAMA_DEBUG=false
# Pull weights at build time so cold start is a model load, not a 9.6 GB download.
RUN ollama serve & \
    for i in $(seq 1 30); do ollama list >/dev/null 2>&1 && break; sleep 1; done; \
    ollama pull "$MODEL" && \
    ollama list && \
    kill $!
EXPOSE 8080
ENTRYPOINT ["ollama", "serve"]
```
No URL appears in this file (the no-network test scans it).

- [ ] **Step 3: Write `cloud/deploy.ps1`**

Header comment explaining what it does and the cost cap. Parameters with defaults: `-Project` (default `$env:GCP_PROJECT`, error if empty), `-Region "us-east4"`, `-Service "disclosure-gemma"`, `-Model "gemma4:e4b"`, `[int]-MinInstances 0`, `[int]-MaxInstances 3`, `[int]-Concurrency 4`.

Body, in order; `$ErrorActionPreference = "Stop"`; after each native call check `$LASTEXITCODE -ne 0` and `throw` with the step name:
1. `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $Project`
2. `gcloud artifacts repositories describe disclosure --location $Region --project $Project` ; if it fails, `gcloud artifacts repositories create disclosure --repository-format docker --location $Region --project $Project`. (Second run must not fail.)
3. `$tag = $Model -replace '[^a-z0-9]', '-'`; `$image = "$Region-docker.pkg.dev/$Project/disclosure/$Service`:$tag"`
4. `gcloud builds submit $PSScriptRoot --tag $image --project $Project --timeout 1800`. The model comes from the Dockerfile `ARG MODEL` default; `--tag` builds cannot pass build args. If `-Model` differs from `gemma4:e4b`, the script rewrites the `ARG MODEL=` line in a temporary copy of the Dockerfile before submitting (copy `cloud/` to `$env:TEMP\disclosure-cloud`, edit there, submit that folder).
5. `gcloud beta run deploy $Service --image $image --project $Project --region $Region --gpu 1 --gpu-type nvidia-l4 --no-gpu-zonal-redundancy --cpu 8 --memory 32Gi --no-cpu-throttling --no-allow-unauthenticated --timeout 300 --concurrency $Concurrency --min-instances $MinInstances --max-instances $MaxInstances --set-env-vars "OLLAMA_NUM_PARALLEL=$Concurrency,OLLAMA_HOST=0.0.0.0:8080,OLLAMA_KEEP_ALIVE=-1" --startup-probe "tcpSocket.port=8080,initialDelaySeconds=10,failureThreshold=30,periodSeconds=10"`
6. On a deploy failure whose output mentions `quota`, write: "GPU quota not granted yet. Open the Cloud Run quotas page in the console, filter for Nvidia L4 without zonal redundancy in $Region, and request 3." No URL.
7. Print:
   ```
   Deployed. Next, in a second terminal keep this running:
     gcloud run services proxy disclosure-gemma --region us-east4 --port 9090
   Then set in .env:  DISCLOSURE_OLLAMA_URL=http://127.0.0.1:9090
   ```

- [ ] **Step 4: Write `cloud/README.md`**

Sections: What this is (one paragraph); Prerequisites (gcloud installed, logged in, project with billing, roles `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/serviceusage.serviceUsageConsumer`, `roles/artifactregistry.admin`, `roles/cloudbuild.builds.editor`; owners have all); Deploy (`.\cloud\deploy.ps1 -Project <id>`); Connect the laptop (proxy command, `.env` lines `DISCLOSURE_OLLAMA_URL=http://127.0.0.1:9090`, `DISCLOSURE_MODEL=gemma4:e4b`, `DISCLOSURE_WORKERS=4`); Demo day (`gcloud run services update disclosure-gemma --region us-east4 --min-instances 1`, and back to `0` after); Scaling (table: concurrency 4 per instance, 3 instances default quota, 12 concurrent photos, next steps); Cost (L4 $0.0001867/s without zonal redundancy, about $0.67/h GPU plus about $0.08/h CPU and memory; `--max-instances 3` caps at about $2.25/h; create billing alerts at $100, $200, $300 in the console); Tear down (`gcloud run services delete disclosure-gemma --region us-east4`, `gcloud artifacts repositories delete disclosure --location us-east4`). Links to the Google tutorial and GPU docs are allowed here (Markdown is not scanned).

- [ ] **Step 5: Verify the no-network test still passes**

Run: `python -m pytest tests/test_no_network.py -v`
Expected: 2 passed. If `deploy.ps1` fails it, remove the offending URL text.

- [ ] **Step 6: Commit**

```bash
git rm -q --cached cloud/.gitkeep 2>/dev/null; rm -f cloud/.gitkeep
git add cloud/Dockerfile cloud/deploy.ps1 cloud/README.md
git commit -m "Add Cloud Run GPU deployment for Gemma via Ollama"
```

---

### Task 5: Laptop wiring: run.ps1, .env.example, Gate 0 script

**Files:**
- Modify: `run.ps1`
- Modify: `.env.example`
- Modify: `scripts/gate0_ollama.py:34`
- Modify: `README.md` (Settings paragraph, line 108 today)

**Interfaces:**
- Consumes: `config.OLLAMA_URL` default `http://127.0.0.1:11434`; `PROXY_FIX` string.
- Produces: `run.ps1` prints `Model server: local Ollama` or `Model server: hosted (<url>)`.

- [ ] **Step 1: `.env.example`**

Append:
```dotenv

# Model server. Leave unset for Ollama on this computer.
# For the Cloud Run GPU service (see cloud/README.md), run the proxy and set:
# DISCLOSURE_OLLAMA_URL=http://127.0.0.1:9090
# DISCLOSURE_MODEL=gemma4:e4b
# DISCLOSURE_WORKERS=4
# DISCLOSURE_OLLAMA_TOKEN=   # only for a direct IAM token; empty when using the proxy
```

- [ ] **Step 2: `scripts/gate0_ollama.py`**

Replace `BASE_URL = "http://127.0.0.1:11434"` with `BASE_URL = config.OLLAMA_URL` (`config` is already imported above it). Nothing else changes.

- [ ] **Step 3: `run.ps1` health check**

Replace the hardcoded Ollama check with:
- Read `.env` if present: for lines matching `^\s*DISCLOSURE_OLLAMA_URL\s*=\s*(.+)$`, take group 1 trimmed of quotes. Default `http://127.0.0.1:11434`. Call it `$modelUrl`.
- `$isLocal = $modelUrl -match '^https?://(127\.0\.0\.1|localhost):11434/?$'`
- Probe `"$($modelUrl.TrimEnd('/'))/api/tags"` with `Invoke-RestMethod -TimeoutSec 3`.
- Success: `Write-Host ("Model server: " + ($(if ($isLocal) {"local Ollama"} else {"hosted ($modelUrl)"})))`.
- Failure, local: today's yellow message.
- Failure, hosted: `Write-Host "Hosted model server not reachable. In another terminal run:" -ForegroundColor Yellow` then `Write-Host "  gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"`.

- [ ] **Step 4: README settings line**

In the Settings paragraph add `DISCLOSURE_OLLAMA_URL` (default `http://127.0.0.1:11434`; set to `http://127.0.0.1:9090` with the Cloud Run proxy, see `cloud/README.md`) and `DISCLOSURE_OLLAMA_TOKEN`.

- [ ] **Step 5: Run the no-network test**

Run: `python -m pytest tests/test_no_network.py -v`
Expected: 2 passed.

- [ ] **Step 6: Manual check, local mode**

With no `.env` present (rename it temporarily if it exists): `.\run.ps1` prints `Model server: local Ollama` or the yellow local message. Stop the server with Ctrl+C. Restore `.env`.

- [ ] **Step 7: Manual check, hosted mode without proxy**

Add `DISCLOSURE_OLLAMA_URL=http://127.0.0.1:9090` to `.env`. `.\run.ps1` prints the yellow hosted message with the proxy command. Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add run.ps1 .env.example scripts/gate0_ollama.py README.md
git commit -m "Point run.ps1, Gate 0 script and env example at a configurable model server"
```

---

### Task 6: Build, deploy, connect, measure

**Files:**
- Modify: `docs/gate0.md` (new section)
- Create: `data/gate0/cloud-run/` evidence (git-ignored, referenced from docs)

**Interfaces:**
- Consumes: `cloud/deploy.ps1` from Task 4; `$env:GCP_PROJECT` from Task 0.

- [ ] **Step 1: Deploy**

```powershell
.\cloud\deploy.ps1 -Project $env:GCP_PROJECT
```
Expected: Cloud Build finishes (10 to 20 minutes, the 9.6 GB pull dominates), then "Deployed." If the build fails on disk space, add `--machine-type e2-highcpu-8` to the `gcloud builds submit` call in `deploy.ps1` and re-run.

- [ ] **Step 2: Describe the service**

```powershell
gcloud run services describe disclosure-gemma --region us-east4 --format="yaml(spec.template.spec.containers[0].resources,spec.template.metadata.annotations)"
```
Expected: `nvidia.com/gpu: "1"`, `autoscaling.knative.dev/maxScale: "3"`, `run.googleapis.com/gpu-zonal-redundancy-disabled: "true"`.

- [ ] **Step 3: Re-run deploy to confirm idempotence**

```powershell
.\cloud\deploy.ps1 -Project $env:GCP_PROJECT
```
Expected: succeeds; repository-exists step is skipped, not failed.

- [ ] **Step 4: Start the proxy in a second terminal (leave it running)**

```powershell
gcloud run services proxy disclosure-gemma --region us-east4 --port 9090
```
Then in the first terminal:
```powershell
curl.exe -s http://127.0.0.1:9090/api/tags
```
Expected: JSON containing `"name": "gemma4:e4b"`.

- [ ] **Step 5: Gate 0 against the hosted model**

Ensure `.env` has `DISCLOSURE_OLLAMA_URL=http://127.0.0.1:9090` and `DISCLOSURE_MODEL=gemma4:e4b`, then:
```powershell
.\.venv\Scripts\python.exe scripts\gate0_ollama.py
```
Run it twice. Record first-run (cold) and second-run (warm) elapsed seconds and whether the description is image-specific. Copy its output files into `data/gate0/cloud-run/`.

- [ ] **Step 6: End-to-end through the app**

`.\run.ps1` prints `Model server: hosted (http://127.0.0.1:9090)`. Open `http://127.0.0.1:8000`, upload one fixture photo from `assets/test_photos/`, confirm a finding arrives with a grade.

- [ ] **Step 7: Throughput measurement**

With `DISCLOSURE_WORKERS=4` in `.env`, restart `run.ps1`, then:
```powershell
.\.venv\Scripts\python.exe scripts\run_test_set.py
```
Record photos per minute. Compare with the laptop figure in `docs/gate0.md` if one exists.

- [ ] **Step 8: Cold-start behaviour**

Stop the proxy, press Retry on a photo in the UI: banner shows the proxy command; the photo stays pending. Restart the proxy: the pending photo completes without reupload. Then wait 15 minutes idle and run:
```powershell
gcloud run services describe disclosure-gemma --region us-east4 --format="value(status.traffic)"
```
and check the Cloud Run console metrics show instance count 0. Upload another photo; it must complete (cold start) within the 120 s timeout, or come back as "Analysis timed out" with Retry working on the second try. Record which.

- [ ] **Step 9: Write the evidence section**

Add `## Cloud Run GPU (us-east4, gemma4:e4b)` to `docs/gate0.md` with: date, Ollama tag pinned, image-specific yes/no for each fixture, cold and warm latency, photos per minute at 4 workers, cold-start outcome, and the path `data/gate0/cloud-run/`.

- [ ] **Step 10: Commit**

```bash
git add docs/gate0.md
git commit -m "Record Cloud Run GPU Gate 0 evidence"
```

---

### Task 7: Honesty: README, in-app copy, plan amendments

**Files:**
- Modify: `README.md` lines 5, 51-60 (Privacy), 112-125 (Architecture Mermaid)
- Modify: `frontend/src/routes/about.tsx:37-39`
- Modify: `frontend/src/routes/faq.tsx:31-32`
- Modify: `frontend/src/routes/index.tsx:133-135`
- Modify: `frontend/src/routes/privacy.tsx:17-20, 30-32`
- Modify: `static/index.html:25`
- Modify: `frontend/src/lib/disclosure/analyzer.ts:111`
- Modify: `PLAN.md` after line 35 and after line 257
- Modify: `Disclosure hackathon plan and gaps.md` row "MLH Best Use of Google Cloud"
- Modify: `docs/decisions.md` ("Choices made while building")

**Interfaces:** none (copy only). Privacy copy is the verbatim paragraph in Global Constraints; call it PRIVACY_COPY below.

- [ ] **Step 1: README**

Line 5: replace "The AI runs on your own computer. Nothing is uploaded unless you choose to email yourself the finished report." with "The AI runs on a private GPU server we host on Google Cloud, or on your own computer if you run Ollama locally. Photos are stripped of location and device data before they leave." Privacy section: replace the "only outbound calls" bullet with: outbound calls are to the model server named by `DISCLOSURE_OLLAMA_URL` (local Ollama, or the Cloud Run service through an authenticated proxy) and the optional SMTP server; the hosted server does not store photos; the no-network test still forbids any hardcoded external URL. Mermaid: rename node `OL` to "Ollama + Gemma 4 (local or Cloud Run GPU)".

- [ ] **Step 2: Frontend copy**

- `about.tsx`: replace the second paragraph text with PRIVACY_COPY followed by " There are no accounts."
- `faq.tsx` "Where do my photos go?" answer: PRIVACY_COPY.
- `index.tsx` badge: "Location data stripped. Photos analyzed on our private server, not stored. No account."
- `privacy.tsx` first section: title "Where your photos are analyzed", body PRIVACY_COPY. Fourth section last sentence: replace "Skip it and nothing leaves this computer." with "Skip it and only the analysis request leaves this computer."
- `analyzer.ts:111`: "The AI model server is not reachable."
- `static/index.html:25`: replace "A local AI model" with "Our AI model".

- [ ] **Step 3: PLAN.md amendments**

After line 35 insert a paragraph beginning "**Amendment, October 24, 2026:**" stating that hosted inference on Google Cloud Run GPU (Ollama, `gemma4:e4b`) is now in scope, the backend and data stay local, and the privacy copy was rewritten; link the spec path. After line 257 insert "**Amendment, October 24, 2026:** the model server URL may be a hosted Cloud Run service supplied through `DISCLOSURE_OLLAMA_URL`; no URL is hardcoded and the no-network test still enforces that."

- [ ] **Step 4: Gaps table and decisions**

Gaps row: `| MLH Best Use of Google Cloud | Possible | Inference runs on Cloud Run GPU; see cloud/README.md. |`. In `docs/decisions.md` under "Choices made while building" add a bullet "**Hosted inference (October 24, 2026).**" summarizing the Cloud Run service, L4, scale-to-zero, cost cap, and that local Ollama remains supported.

- [ ] **Step 5: Frontend checks**

Run: `cd frontend; bun run lint; bun run test`
Expected: no errors; existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add README.md frontend/src static/index.html PLAN.md "Disclosure hackathon plan and gaps.md" docs/decisions.md
git commit -m "Describe hosted inference honestly in README, app copy and plan"
```

---

### Task 8: Final verification

**Files:** none

- [ ] **Step 1: Full backend test run**

Run: `python -m pytest -q`
Expected: all passed, 0 failed (skips allowed only in `test_status_messages`).

- [ ] **Step 2: Scan for placeholders**

Run: `git grep -n -i "TODO\|PLACEHOLDER\|TBD" -- cloud app/config.py app/inference run.ps1`
Expected: no output.

- [ ] **Step 3: Confirm scale-to-zero cost state**

```powershell
gcloud run services describe disclosure-gemma --region us-east4 --format="value(spec.template.metadata.annotations['autoscaling.knative.dev/minScale'])"
```
Expected: empty or `0`. If demo day is tomorrow, leave it at 0 tonight and set `--min-instances 1` in the morning per `cloud/README.md`.

- [ ] **Step 4: Push**

```bash
git push origin main
```
