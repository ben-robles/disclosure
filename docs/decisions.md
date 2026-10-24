# Decisions

## Phase status

| Phase | State |
|---|---|
| Gate 0 (Gemma sees images) | **Not done.** Needs the Gemma machine. Template in `gate0.md`. |
| 1 Skeleton | Done and verified here (server, welcome view, 390 px layout, `run.ps1` untested on a fresh window). |
| 2 Inference core | Code done: `DefectAnalyzer`, Ollama implementation, taxonomy-built prompt, parsing with retry, EXIF strip and resize. Tested against a local stub server only. **Never run against real Gemma.** Prompt v1 is untuned. |
| 3 Grading, costs, data, queue | Done, 72 pytest tests green. |
| 4 UI flow | Done. Driven end to end in Edge at 390 px with a fake analyzer. Not yet tested with Narrator or on a phone over Wi-Fi. |
| 5 Report | Done. PDF has the footer on every page and findings grouped by Maryland form question. |
| 6 Guardrails, adversarial set, docs | Guardrails 1-6 and 8 done and covered by tests. Guardrail 7 (startup banner) done. Test photo set done (15 Wikimedia Commons photos, licenses in `test_photos.csv`). **`docs/test-results.md` not done** (needs Gemma). |

## Choices made while building

- **Stored image is the 1024 px sanitized JPEG.** Original is never kept. The report uses the same file.
- **Edited findings are graded as high confidence.** An edit is the seller's own judgement, so it shows a single letter and is marked "Edited by you". Editing un-confirms the finding.
- **Can't-tell findings can be confirmed** into the report (shown under "Needs review by a licensed home inspector"). Blurry, not-a-house, timeout and unreachable cards can only be retaken, retried or deleted.
- **Medium-confidence label.** Badge text is "Serious to Urgent", from the best-end and worst-end letters, so the aria-label does not understate the worse letter.
- **Maryland mapping.** Form fetched from the Maryland Department of Labor, printed revision "Rev August 3, 2026". Five types map to a numbered question (3 Foundation, 5 Roof, 7 Plumbing system, 10 Electric Systems, 17 Wood-destroying insects). `water_intrusion`, `mold_mildew` and `window_door_rot` have no matching question and go under question 25 (other material defects). This is weaker than the "nearly one-to-one" claim in the plan. `unclear` goes in a separate inspector group.
- **Extra modules** beyond the plan layout: `app/present.py` (shared display dicts for API and PDF), `app/config.py`, `tests/dev_server.py` (runs the real app with a canned fake analyzer, for UI checks without Gemma).
- **Concurrency (added by someone else while I was building):** `app/queue.py` runs `DISCLOSURE_WORKERS` threads (default 4), `claim_pending` is one atomic `UPDATE ... RETURNING`, and `keep_alive` is sent to Ollama. Four parallel image requests on a laptop GPU may be slower or run out of memory. Set `DISCLOSURE_WORKERS=1` first if Gate 0 shows trouble, and set Ollama's `OLLAMA_NUM_PARALLEL` to match.
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
