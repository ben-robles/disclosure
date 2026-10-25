# Gate 0 — Windows certification pending

**Not passed.** The runner and licensed fixtures are implemented, but no real Gemma
measurements have been collected on the Windows demo laptop. Development tests on
macOS do not certify this gate. Model identity, size, image specificity, latency,
JSON-schema support and resource measurements remain unverified on Windows.

## Run on the Windows demo laptop

Open this repository in Codex on Windows. Install Python 3.11+ and
[Ollama for Windows](https://ollama.com/download/windows), then use PowerShell:

```powershell
# Create the environment if needed; use an installed Python 3.11+ interpreter.
py -3.11 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
# Quit Ollama using its system-tray menu; stop any existing ollama serve.
.\scripts\gate0_windows.ps1
```

The wrapper refuses to stop an existing Ollama process or use an occupied port.
It starts its own local server with cloud features disabled, pulls `gemma4:e2b`,
and records `ollama show`, model digest, download size and server/client versions.
[E2B is listed as image-capable](https://ollama.com/library/gemma4:e2b); the actual
installed model must advertise `vision` before the suite proceeds.

Each run writes a unique directory under `data/gate0/` containing:

- `environment.json`: Windows version/build, RAM, video controllers, NVIDIA
  VRAM/driver information when available, Python, Git, Ollama and free disk.
- `workers-1.json` and `workers-4.json`: cold HTTP response for the first photo
  after explicit model unload; warm streamed responses for both photos; structured
  output using the app prompt/schema; production analyzer results and all retry
  replies; CLI stdout/stderr; three warmed four-photo batches per worker setting.
- `resources-1.jsonl` and `resources-4.jsonl`: sampled Ollama process working set,
  available system RAM, and NVIDIA GPU memory/utilization when available.
- Server logs, sanitized photos, `ollama-show.txt`, and `comparison.json`.
- Draft `gate0.md` and `environment.md` reports, ready for review and recording.

The server is restarted between settings with `OLLAMA_NUM_PARALLEL` matching the
worker count. Only its owned process tree is stopped. Process environment variables
are restored at exit. The model remains downloaded. Resource sampling is once per
second across probes and batches; sampled maxima may miss brief peaks. Integrated
and non-NVIDIA GPU utilization is not measured; record that limitation and use
Windows Task Manager if more detail is needed.

The existing direct check remains available when Ollama is already running:

```powershell
.\.venv\Scripts\python scripts\gate0_ollama.py gemma4:e2b assets\test_photos\gate0_water_stain.jpg
.\.venv\Scripts\python scripts\gate0_ollama.py gemma4:e2b assets\test_photos\gate0_chimney_spalling.jpg --structured
```

First-content latency is measured from the first nonempty streamed `content`
chunk, excluding thinking chunks. It is not the model's internal first-token
metric. Production and CLI calls record total duration only. Streaming evidence
retains all NDJSON lines and final Ollama load/evaluation timing statistics.

## Acceptance and recording

Inspect both [fixture photos and expected details](../assets/test_photos/ATTRIBUTION.md)
against the saved CLI, HTTP and production replies. Confirm the ceiling stain and
peeling area is distinguished from the eroded brick chimney and debris. Valid JSON,
a successful HTTP status or a generic description does not prove vision.

Pass requires both photos to receive coherent, image-specific replies, warm HTTP
and production responses below approximately 60 seconds each, valid structured
findings with successful production analysis status, and completed concurrency and
resource measurements. Report cold-load time separately. A failed four-worker run
can still lead to a one-worker configuration if all one-worker checks pass.

The comparison recommends four workers only if both settings pass technical checks
and the median of three four-photo batches is lower for four workers. Every batch
must have four successful responses below 60 seconds per photo; ties, failures or
slower batches select one. Results are always `review_required` or `failed`, never
an automatic claim of image-specific correctness.

After reviewing real Windows evidence, Codex should:

1. Copy the measured draft reports into `docs/gate0.md` and `docs/environment.md`.
   Preserve the raw evidence locally; include model digest, size, response text,
   timing tables, resource results, reviewer/date and any measurement limitations
   in the tracked report so it is reviewable without the gitignored files.
2. Record the image-specific pass/fail verdict and rung reached. Mark Gate 0 passed
   only when all acceptance criteria are supported by the evidence.
3. Set `app/config.py`'s model default to the verified explicit tag and worker
   default to the measured choice. Update README setup and `docs/decisions.md`
   together. Until then the model default remains unverified and workers default
   conservatively to one; the wrapper explicitly supplies E2B for testing.
4. Start Ollama with the verified parallel setting, set `DISCLOSURE_MODEL` and
   `DISCLOSURE_WORKERS` to the same measured configuration, and verify the app's
   production analyzer is ready before running `run.ps1`.

If E2B fails image specificity or latency, retain its evidence and try once:

```powershell
.\scripts\gate0_windows.ps1 -Model gemma4:e4b
```

If both variants fail, leave Gate 0 failed. Follow planning/PLAN.md's runtime ladder:
request a Hugging Face account/terms acceptance before LiteRT-LM, and ask before
llama.cpp. Do not use hosted inference. The full adversarial dataset and accuracy
study remain separate work; these two photos only establish the initial vision gate.

## Development verification

The established tests and new Gate 0 tests are run independently of the untracked
`smoke_test.py` and `tests/test_inference.py`. The former requires an undeclared
Google SDK; the latter imports APIs absent from the current app. Neither file was
changed as part of Gate 0. The macOS workspace's existing `.venv` uses Python 3.9
and lacks dependencies, so verification uses a separate temporary Python environment.
The Windows PowerShell wrapper still requires execution on the target laptop.

Verification on October 24, 2026: **106 tests passed** with
`python -m pytest -q tests --ignore=tests/test_inference.py`, including the new
streaming, failure, benchmark, report and image-fixture checks. The complete
unfiltered run encounters the two pre-existing collection errors described above.

## Supplementary evidence: macOS dev machine (not the demo laptop)

Does not satisfy Gate 0, which must be passed on the Windows demo laptop.

- Machine: macOS, 16 GB RAM, Ollama 0.40.10, tag `gemma4:12b` (7.7 GB, vision listed by `ollama show`).
- Production `OllamaAnalyzer.analyze()` on the two licensed Gate 0 photos (workers=1, temperature 0):
  - `gate0_water_stain.jpg`: `water_intrusion`, severity 2, 30_days, high, "A visible water stain and peeling texture are present on the ceiling near the wall corner." 78.4 s.
  - `gate0_chimney_spalling.jpg`: `foundation_structural`, severity 4, immediate, high, "Significant crumbling and missing bricks in a structural wall." 95.6 s.
- Both labels match the expected taxonomy in `assets/test_photos/ATTRIBUTION.md`; the water-stain reason names specific visible features. The chimney reason is generic ("structural wall" is not what the photo shows, an attic chimney), so image specificity needs a human check.
- Ollama `format` returns HTTP 501 for gemma4. `OllamaAnalyzer` now retries once without `format` and stops sending it for that instance.
- Latency of 78-96 s per photo exceeds the plan's ~60 s target and is close to the 120 s timeout. Likely 12b on 16 GB; try `gemma4:e2b`/`e4b` before relying on it.

## Cloud Run GPU (us-east4, gemma4:e4b)

- Date: October 24, 2026. Ollama image tag pinned: `ollama/ollama:0.40.10`. Service `disclosure-gemma`, one NVIDIA L4, 8 vCPU, 32 GiB, reached through `gcloud run services proxy` on `127.0.0.1:9090`. Ollama logs show the model on `CUDA0`.
- Instance cap: the new project's regional Cloud Run quota is 20 vCPU and 40 GiB, so the deploy is capped at `--max-instances 1` rather than the planned 3. One instance runs 4 requests at once.
- Image-specific: `gate0_water_stain.jpg` gave "A small area of spalling or damage is visible at the junction where the textured ceiling meets the smooth wall" and "A localized area of material deterioration and cracking is visible at the ceiling-wall junction". Both name the ceiling-wall junction in the photo. Only this one fixture was run through `scripts/gate0_ollama.py`; the other 16 test photos were run through the analyzer (below).
- Latency, `gate0_water_stain.jpg`, three runs in a row: run 1 timed out at 120 s (instance and model cold), run 2 57.4 s, run 3 18.8 s.
- Throughput, 4 workers, 17 test photos through `OllamaAnalyzer` against the warm service: 62 s total, 16.3 photos per minute, 17 of 17 returned `analysis_status` `ok`, 7.7 to 21.5 s per photo. This measures speed only. Labels were not scored against expected types.
- Cold start: the first chat request after the instance woke (a `/api/tags` call had started it) exceeded the app's 120 s timeout. A cold first photo will show "Analysis timed out" until Retry. For a demo, set `--min-instances 1` (see `cloud/README.md`). Scale to zero after 15 minutes idle was not measured.
- Evidence files: `data/gate0/cloud-run/` (git-ignored): `run1.json`, `run2.json`, `run3.json`, `throughput.json`.
