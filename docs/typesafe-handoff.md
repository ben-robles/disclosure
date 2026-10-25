# Handoff: add TypeSafe (Jev) to Disclosure

Written 2026-10-24 on branch `cloud-run-gemma`. Goal: build three features that use
TypeSafe's Jev model as a text-only judgment layer next to Gemma. Build them in the
order below. Each one stands alone; stop after any of them and the app still works.

Read first, in this order:

1. `README.md` (what the app promises; the privacy section binds this work).
2. `app/inference/analyzer.py`, `app/inference/prompts.py`,
   `app/inference/ollama_analyzer.py` (the only code that talks to a model).
3. `app/grading.py`, `app/present.py` (how a Finding becomes a grade and display row).
4. `scripts/run_test_set.py`, `docs/gate0.md`, `assets/test_photos/ATTRIBUTION.md`,
   `assets/test_photos/test_photos.csv` (the eval surface).
5. `tests/test_no_network.py` (hard rule: no external URL literal in `app/`,
   `scripts/`, `cloud/`, `run.ps1`).
6. The `/typesafe-ai` skill, then live docs: `https://docs.typesafe.ai/sdk/python.md`,
   `https://docs.typesafe.ai/primitives/noul.md`,
   `https://docs.typesafe.ai/primitives/choice.md`,
   `https://docs.typesafe.ai/confidence.md`,
   `https://docs.typesafe.ai/model-jaggedness/jev-1.13.md`. Docs win over this file.

## Facts about Jev that shape the design (verified 2026-10-24)

- Text only. Image input exists but the docs call it a preview, not production-ready.
  Never send photos. Jev reads Gemma's text output only.
- Hosted only: `POST /v1/systemone`. No self-host. Not trained on customer data;
  zero data retention is enterprise only.
- Price $0.042 per million input tokens, output free. Most calls about 100 ms.
  Context 64k per request, 32k per question. Independent questions in one request run
  in parallel and cannot see each other.
- Python SDK: `pip install typesafe-sdk`; `from typesafe_sdk import Choice, Noul, TypeSafeClient`;
  key in env var `TYPESAFE_API_KEY`. Sync call is `client.system_one(state=..., questions=...)`;
  results in `response.nouls[id].noul` (probability of yes) and `response.choices[id].choice`
  plus per-option probabilities. Confirm against the SDK page before writing code.
- Known rough edges: leans toward the first Choice option (test with shuffled orders);
  literal reading of the question; mismatched instruction/criteria phrasing hurts;
  Score levels weakly calibrated; keep arithmetic and counting in code.
- Noul thresholds: docs suggest starting at 0.7 yes / 0.3 no, then tune on our data.

## Ground rules for all three

- Keep `DefectAnalyzer` the only boundary to Gemma. Add Jev as a separate module
  `app/inference/judge.py` with a small interface (`Judge` ABC + `TypeSafeJudge` +
  `NullJudge`) so tests and the dev server never call the network.
- Configure through `app/config.py`: `DISCLOSURE_TYPESAFE_URL` (empty = feature off),
  `TYPESAFE_API_KEY`, `DISCLOSURE_TYPESAFE_MODEL` (default `jev-latest`). The SDK's base URL
  must come from env, never a literal, or `tests/test_no_network.py` fails. Add the new
  vars to `.env.example`.
- Jev failure (network, 429, timeout) never blocks a finding. Fall back to Gemma's answer
  and record `judge_status` on the row (`ok | skipped | unavailable`). Never raise.
- Jev never writes user-visible text. It returns probabilities and picks; code maps them
  to existing states and messages in `app/present.py`.
- Update `README.md` sections "Privacy" and "Architecture": Gemma's one-sentence
  `reason`, `title` and typed fields go to the TypeSafe API; photos, ZIP, email never do.
  Say the feature is off unless `DISCLOSURE_TYPESAFE_URL` is set.
- Tests for every feature with a fake judge. Run `.\.venv\Scripts\python -m pytest`
  before each commit. Bump `PROMPT_VERSION` in `prompts.py` if the Gemma prompt changes.

## Feature 1: offline eval grader (build first; dev tooling, lowest risk)

Purpose: give `scripts/run_test_set.py` and Gate 0 an automatic score instead of a
human eyeballing model replies. Runs only on the licensed public test photos.

- Input per photo: Gemma's `reason` + `title` + `defect_type`, and the expected values.
  Expected `defect_type` comes from `assets/test_photos/test_photos.csv`; expected visible
  details for the two Gate 0 photos come from `assets/test_photos/ATTRIBUTION.md`. Add an
  `expected_details` column (short phrase) to the CSV for the other photos; mark the
  blurry / not-a-house / normal-room rows so they are checked on `image_quality` or
  `unclear` only.
- Questions, one request per photo, state = `{"model_reason", "model_title",
  "model_defect_type", "expected_defect_type", "expected_details"}`:
  - Noul `mentions_expected`: does `model_reason` or `model_title` describe
    `expected_details`?
  - Noul `type_consistent`: does `model_reason` describe damage of kind
    `expected_defect_type`? (Separate from exact id match, which code already checks.)
- Output: extend `docs/test-results.md` writer with columns `exact_match`,
  `mentions_expected_p`, `type_consistent_p`, `judge_status`, and a summary line with
  mean values and `PROMPT_VERSION`. Keep raw per-photo JSON under `data/eval/<run>/`.
- Add `--no-judge` flag so the script still works with no key.
- Caveat to state in the output header: about 15 photos; regression harness, not a
  validation study.

## Feature 2: verify Gemma's answer live (second opinion per finding)

Purpose: the model that makes a claim no longer grades its own homework. Replaces the
self-reported `category_fits` with an independent text check.

- Hook point: `app/queue.py` worker, after `analyzer.analyze()` returns a Finding with
  `analysis_status == "ok"` and `image_quality == "ok"` and `defect_type != "unclear"`.
  Do not call Jev for blurry / not-a-house / unclear / timeout / unavailable.
- State: `{"reason", "title", "defect_type_id", "defect_type_label", "defect_type_look_for",
  "severity", "urgency"}` with label and look_for from `assets/defect_taxonomy.json`.
- Questions, one request:
  - Noul `label_matches`: does the description in `reason` and `title` show the problem
    named by `defect_type_label` (things to look for: `defect_type_look_for`)?
  - Noul `severity_plausible`: is severity `severity` (1 trivial to 5 dangerous or
    structural) consistent with what `reason` describes?
  - Noul `has_cost_or_legal`: does `reason` or `title` state a dollar amount, a legal
    conclusion, or liability language? (Backs the README "never" promise; also keep a
    `$\d` regex in code.)
- Mapping, thresholds start at 0.7/0.3 and are tunable in config:
  - `label_matches < 0.3` -> set `category_fits = False` (existing path: UI shows the
    model's title and "Other issue" handling in `present.display_label`).
  - `severity_plausible < 0.3` -> demote `confidence` one step (high -> medium -> low);
    low already means no grade. Never raise confidence.
  - `has_cost_or_legal > 0.7` -> replace `reason` with the taxonomy `look_for` text
    and set `title = ""`. Model text with money or legal claims never reaches the report.
  - Between thresholds: leave Gemma's answer alone. Store raw probabilities on the row.
- DB: add columns `judge_status`, `judge_label_p`, `judge_severity_p`, `judge_guard_p`
  in `app/db.py` with a migration for existing `data/disclosure.sqlite3`.
- Stop sending `category_fits` instructions to Gemma only after Feature 2 is measured with
  Feature 1; until then keep both and compare.
- Tests: fake judge returning fixed probabilities; assert each mapping rule; assert
  unavailable judge leaves the Finding unchanged and sets `judge_status = "unavailable"`.

## Feature 3: calibrated confidence (largest refactor; build last)

Purpose: the grade width (one letter / two letters / no grade) currently hangs on Gemma
saying "high / medium / low" about itself. Replace that with a measured distribution.

- New Gemma prompt (bump `PROMPT_VERSION` to v4): Gemma returns only `reason`, `title`,
  `severity`, `urgency`, `image_quality`. No `defect_type`, no `confidence`,
  no `category_fits`. Keep the JSON schema path in `ollama_analyzer.py` for the fields
  that remain.
- Jev Choice `defect_type` over the 28 taxonomy ids (exclude `unclear`; add explicit
  option `none_of_these`), criteria = `{id: look_for}` from the taxonomy, state =
  `{"reason", "title"}`. Shuffle option order per request and keep a stable mapping back
  to ids, because Jev leans toward the first option.
- Confidence mapping from the Choice (start values; tune with Feature 1 results):
  top probability >= 0.75 -> `high`; 0.45 to 0.75 -> `medium`; below 0.45 or top option
  `none_of_these` -> `low` (becomes `unclear`, no grade, inspector message). Store the top
  three ids and probabilities on the row so the review screen can offer them as edit
  suggestions.
- Jev unavailable -> `unclear_finding("The AI model is not reachable.", "unavailable")`
  path already shows Retry. Do not silently grade without a type.
- Keep `app/grading.py`, `app/costs.py`, `app/report/mapping.py` unchanged. They are
  deterministic policy and tested.
- Measure before and after with Feature 1 on the test set; record both in
  `docs/test-results.md`. If v4 scores worse than v3 on `exact_match`, keep v3 and
  file the result in `docs/decisions.md`.

## Do not use Jev for

Blurry / not-a-house detection (visual), report prose (Jev does not generate text),
grading math, cost table, Maryland form mapping, ZIP or email validation.

## Done means

- All three features behind env flags, off by default, tests green with `NullJudge`.
- `tests/test_no_network.py` still passes.
- `README.md` privacy and architecture sections updated; `.env.example` updated.
- `docs/test-results.md` shows a Feature 1 run for prompt v3 and, if Feature 3 shipped,
  v4. Commit messages carry no AI attribution (project rule).
