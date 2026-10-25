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

- **Hosted inference (October 24, 2026).** Gemma 4 (`gemma4:e4b`) runs on a private Cloud Run service with one NVIDIA L4, scale to zero, at most 1 instance (about $0.75 per hour cap; the regional quota on a new project does not fit 3). The laptop reaches it through `gcloud run services proxy` on port 9090 via `DISCLOSURE_OLLAMA_URL`. Local Ollama remains supported and is the default.
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

## TypeSafe text judge (Jev)

- **Off by default.** `DISCLOSURE_TYPESAFE_URL` empty means no network call. Verify and classify each have their own flag (`DISCLOSURE_JUDGE_VERIFY`, `DISCLOSURE_JUDGE_CLASSIFY`); classify also needs a key, otherwise Gemma keeps naming the type (prompt v3).
- **Text only.** The judge receives Gemma's `reason`, `title` and typed fields. Photos, ZIP and email never go to TypeSafe. It returns probabilities and picks; `app/verify.py` and `app/classify.py` map them to states, so no judge-written text reaches a report.
- **Thresholds are starting values, not tuned.** Yes 0.7, no 0.3 (TypeSafe's docs suggest these); confidence high at 0.75 and medium at 0.45 of the top choice. Nothing has been run against the live API yet. Tune on the test set with `scripts/run_test_set.py`, then record results here.
- **Choice with a `none_of_these` option.** TypeSafe's Choice docs warn such options may work poorly and suggest a companion yes/no question instead. Not built; revisit if the test set shows `none_of_these` over- or under-firing.
- **A dollar sign followed by a digit is also caught by regex**, independent of the judge, so a cost in model text is scrubbed even when the judge is down.
- **Not wired:** the single-photo `/api/analyze` route used by the React UI still returns Gemma's raw finding. Verify and classify apply only to the stored-session worker.
- **v4 vs v3:** run `run_test_set.py` and `run_test_set.py --classify`; both sections land in `docs/test-results.md`. If v4 scores lower on `exact_match`, keep v3 (leave the classify flag off) and note it here.

### v3 vs v4 on the test set (2026-10-24, gemma4:e4b, TypeSafe `jev-latest`, one run each)

- **v3 (Gemma names the type): 12 of 17 exact_match. v4 (judge picks the type): 10 of 17.** Per the rule above, v3 stays and `DISCLOSURE_JUDGE_CLASSIFY` stays off.
- v3 misses: mold photo (called `unclear`), brick crack (`siding_exterior`), window and door rot (`pest_wood_damage`, `siding_exterior`), termites (`water_intrusion`).
- v4 fixed the brick crack and the door rot but lost the ceiling stain, mold, open switches, the plumbing leak (Gemma called the photo blurry) and the chimney (judge `none_of_these`).
- Most v4 misses start in Gemma's sentence, not the judge: the judge scored those sentences low against the expected details too (for example `mentions_expected_p` 0.14 on the ceiling stain). A single run each, 15 photos, so differences of a few photos are noise. Rerun before drawing more from it.
- Judge mean scores are close: `mentions_expected_p` 0.52 (v3) and 0.51 (v4), `type_consistent_p` 0.67 and 0.63.

### Rerun and verify check (2026-10-24, second run of each prompt)

- **Same totals on rerun: v3 12 of 17, v4 10 of 17.** Per photo, v4 reliably fails the chimney and plumbing photos (Gemma's v4 sentence or the judge's `none_of_these`) and wobbles on the ceiling stains, electrical switches and termites. v3 is steadier. **Decision: drop classify (leave `DISCLOSURE_JUDGE_CLASSIFY` off); keep v3.**
- **Verify on the 11 gradable v3 findings from the rerun:** it flagged the mold photo that Gemma labelled `hvac_heating` (`label_matches` 0.07, so the UI shows the model's title) and changed nothing on the 7 correct ones. It missed 3 wrong types (door frame, termites, window frame) because Gemma's sentence agreed with its own wrong label. Severity and the cost/legal guard never fired. **Decision: keep verify on.** It catches some self-contradictions; it is not a second pair of eyes on the photo.

### Verify now moves the category (2026-10-24)

When `label_matches` is below the no-threshold, verify asks the judge to pick a category from Gemma's text (one more call). If the pick is not `none_of_these`, differs from Gemma's type and has probability of at least 0.45, the finding moves to it: grade, cost, "pro", report section and the displayed label all follow, and confidence is capped at what the judge's probability supports (never raised). Otherwise the type stays and the model's own title is shown, as before. Limit: the judge only reads Gemma's sentence, so when the sentence describes the wrong thing (the mold photo, described as an HVAC fan) the move cannot fix it.
