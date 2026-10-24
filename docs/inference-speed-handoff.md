# Handoff: faster local photo analysis

Date: October 24, 2026

## Objective and recommendation

Reduce the wait for each photo while retaining image-specific findings and the
existing guardrails. Start with `gemma4:e2b`, compare it with `gemma4:e4b`, and
choose the smallest model that passes the photo evaluation. Both support image
input according to the [Ollama model page](https://ollama.com/library/gemma4:e2b).
Neither has been validated for Disclosure on the Windows demo laptop yet.

The app asks for a fixed defect category and a short JSON finding. That makes a
smaller model a reasonable candidate, but does not establish that it will identify
defects reliably. Do not promise a speedup factor or acceptable accuracy before
measuring them. Keep Gemma 4 and local inference as required by `PLAN.md`.

| Model | Role in the comparison |
|---|---|
| `gemma4:e2b` | First candidate for lower compute and faster responses. |
| `gemma4:e4b` | Compare if E2B misses details, fails guardrails, or returns unreliable JSON. |
| `gemma4:12b` | Existing development baseline; retain only if measurements justify its latency. |

## Evidence already available

- [Gate 0 notes](gate0.md#supplementary-evidence-macos-dev-machine-not-the-demo-laptop)
  record a 16 GB Mac using `gemma4:12b`: **78.4 seconds** for the ceiling stain and
  **95.6 seconds** for the chimney photo. These are recorded results, not new
  measurements made for this handoff. They exceed the plan's approximately
  60-second target and do not certify the Windows laptop.
- The chimney response needs human review for image specificity. Correct taxonomy
  alone is insufficient evidence that the model understood the image.
- `app/config.py` still defaults to the unverified bare tag `gemma4`. Select an
  explicit tag for experiments; change the default only after certification.
- The production analyzer already uses temperature 0 and `keep_alive="30m"`.
  Uploads are already stripped of EXIF and resized to a maximum 1024-pixel edge.
- The installed runtime previously rejected structured `format` with HTTP 501.
  The analyzer now falls back without `format`; keep that behavior while testing.

## Quick model switch

With Ollama running, download the smaller model:

```powershell
ollama pull gemma4:e2b
```

Set or update the following entries in the repository's gitignored `.env` file,
preserving any other settings. Existing process environment variables take
precedence over `.env`, so remove or update an old override if needed.

```dotenv
DISCLOSURE_MODEL=gemma4:e2b
DISCLOSURE_WORKERS=1
```

Restart the backend after changing the settings. On Windows, use `.\run.ps1`;
use `.\run.ps1 -Lan` for the phone demo. This starts the plain JavaScript app in
`static/`. The separate React app uses the same analyzer through `/api/analyze`,
but owns its queue in the browser; the server worker setting does not control
that browser queue.

## Work order for the next session

1. **Run Windows Gate 0 for E2B.** Follow [the existing instructions](gate0.md),
   including quitting any existing Ollama tray/server process before the wrapper:

   ```powershell
   .\scripts\gate0_windows.ps1 -Model gemma4:e2b
   ```

   Review image-specific replies, model identity, cold versus warm latency,
   production JSON results and memory use. The wrapper saves evidence under
   `data/gate0/` and measures one versus four workers with matching Ollama
   parallelism. An automated technical pass still requires human image review.

2. **Compare E4B under the same conditions.** Preserve E2B evidence, then run:

   ```powershell
   .\scripts\gate0_windows.ps1 -Model gemma4:e4b
   ```

   Compare warmed per-photo latency and successful batch completion separately.
   More workers can improve throughput while making individual photos slower or
   exhausting memory. Keep one worker unless measurements support increasing it.

3. **Evaluate the full licensed photo set with each candidate.** Start Ollama
   again after the wrapper exits, select the model in the same PowerShell window,
   and use the production analyzer:

   ```powershell
   $env:DISCLOSURE_MODEL = "gemma4:e2b"
   .\.venv\Scripts\python scripts\run_test_set.py
   Copy-Item docs\test-results.md docs\test-results-e2b.md
   $env:DISCLOSURE_MODEL = "gemma4:e4b"
   .\.venv\Scripts\python scripts\run_test_set.py
   Copy-Item docs\test-results.md docs\test-results-e4b.md
   ```

   The runner overwrites `docs/test-results.md`, so preserve each result before
   the next run. Inspect the table: its exit code is not an accuracy gate.
   Manually review severity, urgency, overconfidence and invented defects on the
   undamaged-room photo; the runner primarily checks category/quality matches.
   Do not infer confidence calibration from a model's self-reported confidence.

4. **Try one speed change at a time if still needed.** Record the model digest,
   runtime version, settings and before/after results for each experiment:

   - **Check GPU loading first.** Run `ollama ps` during analysis. It distinguishes
     full GPU, mixed CPU/GPU and CPU loading. Investigate unexpected CPU loading
     before attributing the entire delay to model size. See the
     [Ollama FAQ](https://docs.ollama.com/faq#how-can-i-tell-if-my-model-was-loaded-onto-the-gpu).
   - **Test thinking disabled.** The current request does not set `think`.
     Inspect the installed tag's `/api/show` thinking metadata; if supported,
     compare an explicit top-level `"think": false` in `_chat_once()` with the
     default. Recheck accuracy and JSON validity. Do not assume thinking is
     currently enabled or that all installed versions support the same control.
     See [thinking controls](https://docs.ollama.com/capabilities/thinking).
   - **Warm the model before the demo.** Run a real photo through the production
     analyzer beforehand. The existing 30-minute keep-alive reduces reloads
     between photos; it does not remove first-load time or accelerate computation.
   - **Only then consider output/context limits or smaller images.** Benchmark
     these changes; a short token limit can truncate JSON and trigger a retry,
     while lower image resolution can hide cracks or wiring details. The existing
     1024-pixel image limit already reduces input size.

5. **Record the chosen configuration.** Update `app/config.py`, README setup,
   `docs/gate0.md`, `docs/environment.md`, `docs/decisions.md`, and the final
   `docs/test-results.md` together after reviewing the evidence. Include the
   verified explicit tag, model digest/size, worker settings, cold and warm
   timings, failures and limitations. The full adversarial evaluation is separate
   from the two-photo Gate 0 smoke test.

## Completion criteria and cautions

- Windows Gate 0 passes with coherent, image-specific findings and approximately
  sub-60-second warm responses according to its existing acceptance criteria.
- Full-set results are recorded and reviewed, including blurry, non-house,
  undamaged and low-confidence behavior. No missing failures are hidden by an
  aggregate category-match score.
- The app uses the tested explicit model tag after restart, and a multi-photo
  capture-to-report flow works on the demo device.
- Do not claim that four workers make one photo faster. Do not claim that a
  smaller model is accurate merely because it returns valid JSON.
- The analyzer's 120-second timeout currently applies to individual HTTP requests;
  invalid-output retries can make total photo latency longer. A strict per-photo
  deadline would require a separate implementation change.
- The backend readiness check can accept another installed Gemma variant for the
  bare `gemma4` default. React checks HTTP success rather than the health body's
  `ready` value. Verify the actual configured model and successful inference;
  do not treat either readiness indicator as certification.
- If both small variants fail Gate 0, follow the runtime ladder and human-input
  requirements in `PLAN.md`; do not silently use hosted inference.

## Verification at handoff

On October 24, 2026, the repository review ran **113 backend tests** and **30
frontend tests**, all passing, and the React production build passed. Backend
HTTP-stub tests needed permission to bind a localhost test socket. These checks
verify application behavior, not real-model speed or defect accuracy.

This handoff changes documentation only. No model was downloaded, benchmarked or
selected, and no inference settings were changed as part of writing it.
