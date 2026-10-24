# Decisions

## Phase status

| Phase | State |
|---|---|
| Gate 0 (Gemma sees images) | **Windows certification pending.** Runner, two licensed photos, streamed timing, production JSON checks and controlled concurrency benchmarks implemented. Run `scripts/gate0_windows.ps1` on the demo laptop; see `gate0.md`. No real Windows Gemma results yet. |
| 1 Skeleton | Done and verified here (server, welcome view, 390 px layout, `run.ps1` untested on a fresh window). |
| 2 Inference core | Code done: `DefectAnalyzer`, Ollama implementation, taxonomy-built prompt, parsing with retry, EXIF strip and resize. Tested against a local stub server only. **Never run against real Gemma.** Prompt v1 is untuned. |
| 3 Grading, costs, data, queue | Done, 72 pytest tests green. |
| 4 UI flow | Done. Driven end to end in Edge at 390 px with a fake analyzer. Not yet tested with Narrator or on a phone over Wi-Fi. |
| 5 Report | Done. PDF has the footer on every page and findings grouped by Maryland form question. |
| 6 Guardrails, adversarial set, docs | Guardrails 1-6 and 8 done and covered by tests. Guardrail 7 (startup banner) done. Test photo set done (15 Wikimedia Commons photos, licenses in `test_photos.csv`). **`docs/test-results.md` not done** (needs Gemma). |

## Choices made while building

- **Hosted inference (October 24, 2026).** Gemma 4 (`gemma4:e4b`) runs on a private Cloud Run service with one NVIDIA L4, scale to zero, at most 3 instances (about $2.25 per hour cap). The laptop reaches it through `gcloud run services proxy` on port 9090 via `DISCLOSURE_OLLAMA_URL`. Local Ollama remains supported and is the default.
- **Stored image is the 1024 px sanitized JPEG.** Original is never kept. The report uses the same file.
- **Edited findings are graded as high confidence.** An edit is the seller's own judgement, so it shows a single letter and is marked "Edited by you". Editing un-confirms the finding.
- **Can't-tell findings can be confirmed** into the report (shown under "Needs review by a licensed home inspector"). Blurry, not-a-house, timeout and unreachable cards can only be retaken, retried or deleted.
- **Medium-confidence label.** Badge text is "Serious to Urgent", from the best-end and worst-end letters, so the aria-label does not understate the worse letter.
- **Maryland mapping.** Form fetched from the Maryland Department of Labor, printed revision "Rev August 3, 2026". Five types map to a numbered question (3 Foundation, 5 Roof, 7 Plumbing system, 10 Electric Systems, 17 Wood-destroying insects). `water_intrusion`, `mold_mildew` and `window_door_rot` have no matching question and go under question 25 (other material defects). This is weaker than the "nearly one-to-one" claim in the plan. `unclear` goes in a separate inspector group.
- **Extra modules** beyond the plan layout: `app/present.py` (shared display dicts for API and PDF), `app/config.py`, `tests/dev_server.py` (runs the real app with a canned fake analyzer, for UI checks without Gemma).
- **Concurrency:** `app/queue.py` runs `DISCLOSURE_WORKERS` threads (default 1 pending Gate 0), `claim_pending` is one atomic `UPDATE ... RETURNING`, and `keep_alive` is sent to Ollama. The Gate 0 wrapper measures three warmed four-photo batches with one and four workers, restarting its own Ollama server with matching parallelism. Four workers are recommended only for faster successful measurements; failures and ties retain one.
- **Gate 0 evidence:** first-content receipt is measured from streaming content, excluding thinking. Raw NDJSON, complete production replies/retries, CLI output, model identity, load/evaluation durations and sampled resource data are retained under `data/gate0/`. Automated checks never certify image specificity. The Windows reviewer must compare both fixture photos with replies before changing the model default or recording a pass.
- **Gate 0 fixtures:** Ed!'s ceiling-water-stain photo (CC BY-SA 3.0) and Beltedweir's spalling-chimney photo (CC BY-SA 4.0), license-checked and visually inspected October 24, 2026. Resized and stripped of EXIF; attribution and expected evidence are in `assets/test_photos/ATTRIBUTION.md`. These are two smoke-test fixtures, not the complete adversarial dataset.
- **Model tag default `gemma4` is a guess.** Gate 0 sets the real tag; override with `DISCLOSURE_MODEL`.
- **Ollama `format` (structured output) is always sent.** Unverified for the chosen tag. If Ollama rejects it, remove it in `ollama_analyzer.py`; the parser already copes with plain JSON.
- **CSP** on the index page: `default-src 'self'`. The PDF response carries no CSP so Chrome's viewer works.

## Human must fill

- `assets/cost_table.json`: every dollar range is PLACEHOLDER.
- `docs/user-interview.md` and `docs/personas.md`: need a real person's words.
- `docs/environment.md` and `docs/gate0.md`: run on the Gemma machine.
- Confirm the current Maryland form revision (the Commission announced a September 2026 update after the August 3 print on the PDF used here).
- README screenshots, measured latency, model size, tested laptop specs.
- Confirm with an organizer that Best Use of Gemma 4 is your one MLH track.
