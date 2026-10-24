# Disclosure — build plan for Claude Code

Read this whole file before writing any code. It is the spec, the order of work, and the rules. Where it says ASK, stop and ask the human; do not guess.

Environment facts (do not re-ask): dev and demo machine is one Windows 11 laptop. The product is a **web app in a phone layout**, served from that laptop. There is no Android Studio, no phone build, no cloud, and no Hugging Face account unless Gate 0 forces the second ladder rung. The repo already exists and is connected to this folder.

---

## 0. Before you start — record, don't ask

Run these and write the results into `docs/environment.md`:
- `systeminfo | findstr /C:"Total Physical Memory"` → RAM
- `nvidia-smi` (if it fails, note "no NVIDIA GPU") → GPU and VRAM
- `python --version`, `git --version`
- Free disk space on the drive you'll install to (the model is several GB)

If RAM is under 16 GB or there is no GPU, still proceed, but choose the smallest Gemma 4 variant in Gate 0 and expect slower answers.

---

## 1. What we are building (locked scope)

**Disclosure** is a seller-side tool. The user photographs defects in their home. Gemma 4, running locally on the laptop, classifies each photo into a fixed defect type with severity, urgency, confidence and a one-line reason. The app turns that into a letter safety grade per finding and overall, attaches a cost range from a hand-built table, lets the seller confirm/edit/remove each finding, and produces a PDF disclosure report for one jurisdiction with an "AI-assisted documentation aid, not an inspection" statement on every page. A mock "recommended professional + request quote" button closes the loop.

**In scope (all must work end to end):**
1. Photo upload from the browser (file picker; on a phone browser this opens the camera), with a prompt to add more angles of the same problem.
2. Gemma 4 analysis producing one structured finding per photo (schema in §4.3). Analysis runs as a server-side queue: closing the browser tab does not stop it; reopening shows progress.
3. Letter grade per finding and overall, shown as a **range** whose width reflects confidence (§4.3).
4. Cost range looked up from the table (§4.4). The model never outputs dollar amounts.
5. Review screen: confirm, edit (type/severity), or delete each finding. Nothing goes in the report unconfirmed.
6. PDF report for one jurisdiction, viewed in-page, with a download button.
7. Guardrails: blurry photo, non-house photo, low confidence → "can't tell, get an inspector" (§5).
8. Mock handoff: recommended pro type + "Request quote" button that shows a confirmation and does nothing else.

**Out of scope — do not build, do not stub, do not leave TODOs for:** accounts, payments, any cloud service, real contractor integration, multiple jurisdictions, video, buyer marketplace, desktop/tablet layouts, a native mobile app, in-browser model execution.

**Tracks:** GDG Best Overall AI for Housing + MLH **Best Use of Gemma 4** (the one MLH pick). Gemma 4 is the only model and does the only inference. Open-source hygiene (license, README) is still required because the GDG rubric scores it.

---

## 2. Stack (decided — do not substitute)

- **Backend:** Python 3.11+, FastAPI + Uvicorn, SQLite via the standard library `sqlite3` (no ORM), Pillow for image handling/EXIF stripping, ReportLab for PDF. One process, one command to run.
- **Frontend:** plain HTML + CSS + vanilla JavaScript in `static/`, served by FastAPI. No Node, no build step, no framework. This is deliberate: fewest toolchains on Windows, nothing for the team to learn.
- **Model runtime:** Gemma 4 via **Ollama for Windows**, called from the backend over its local HTTP API (`http://127.0.0.1:11434`) with the image sent as base64. Ollama hosts the weights, so no Hugging Face account is needed on this rung.
- **Phone layout:** the UI is designed at 390 × 844 and centered in a fixed-width column (max-width 430 px) on any screen. Demo it two ways: Chrome DevTools device mode on the laptop, or a real phone on the same Wi-Fi opening the laptop's address (see §4.6). Both must work.

Why this and not on-device: no demo phone exists. The honest story for judges and the README is: "Gemma 4 runs locally on the laptop today, no cloud, no data leaves the machine; the same model has official on-device runtimes (LiteRT-LM for Android/iOS), so the next step is the phone build." Say exactly that; do not claim it runs on the phone.

---

## 3. Gate 0 — prove Gemma 4 sees images on this laptop (first hour, before any app code)

This is the single biggest risk. Do it first, record numbers, then build.

**Rung 1 — Ollama (default)**
1. Install Ollama for Windows from ollama.com. Confirm `ollama --version`.
2. Check the Gemma 4 library page for the current tag names and pick the smallest instruction-tuned variant that has the `vision` capability (`ollama show <tag>` must list vision). Pull it. Record the tag and size in `docs/gate0.md`.
3. Test from the terminal: `ollama run <tag> "Describe the visible defect in one sentence and rate severity 1 to 5. ./test.jpg"` using any real photo of a crack, stain, or wire from the room.
4. Test the same through the HTTP API with a short Python script (`scripts/gate0_ollama.py`) that sends the image as base64 to `/api/chat` and prints the reply and elapsed time. **This is the real test** — there have been Windows reports of the CLI accepting an image but the model not actually seeing it. If the model describes the image contents specifically, vision works. If it answers generically or says it can't see images, vision is broken: try one other Gemma 4 tag, then move to rung 2.
5. Pass criteria: a coherent, image-specific answer in under ~60 s. Record time-to-first-token, total time, RAM/GPU use.

**Rung 2 — LiteRT-LM CLI on Windows** (only if rung 1 fails vision)
Needs a free Hugging Face account with the Gemma terms accepted — ASK the human to create it. `uv tool install litert-lm`, download `gemma-4-E2B-it` in `.litertlm` format from the `litert-community` org, and run the CLI's OpenAI-compatible server. The backend then talks to that server instead of Ollama. Same `DefectAnalyzer` interface (§4.1), different implementation.

**Rung 3 — llama.cpp `llama-server`** with a Gemma 4 GGUF plus its `mmproj` vision projector. Only if rungs 1 and 2 both fail. ASK before starting this.

If all three fail on this laptop, STOP and ASK. Do not reach for a hosted API.

---

## 4. Architecture and data contracts

### 4.1 Layout (keep this exact separation — it is what "architectural soundness" and "inference cost" are scored on)

```
app/
  main.py            FastAPI app, routes, static serving, startup checks (is Ollama up? is the model pulled?)
  inference/
    analyzer.py      ONE interface: DefectAnalyzer.analyze(image_bytes) -> Finding
    ollama_analyzer.py   the one implementation. Nothing else touches the model.
    prompts.py       the prompt, versioned in a comment, built from the taxonomy file
  grading.py         pure functions: severity+urgency → letter; confidence → range; overall = worst
  costs.py           loads cost_table.json, lookup
  report/
    mapping.py       taxonomy id → jurisdiction form section
    pdf.py           ReportLab generation
  queue.py           background worker thread: pending photos → analyzer → DB
  db.py              sqlite3: sessions, photos, findings (confirmed flag, user edits)
  images.py          EXIF stripping, resize to max 1024 px before inference
static/              index.html, app.css, app.js (phone layout), icons
assets/
  defect_taxonomy.json
  cost_table.json
  jurisdiction_md.json
  test_photos/ + test_photos.csv (source URL + license per photo)
scripts/
  gate0_ollama.py, run_test_set.py
docs/
  environment.md, gate0.md, decisions.md, test-results.md, user-interview.md, personas.md
data/                runtime uploads + sqlite file; gitignored
tests/               pytest for grading, costs, parsing, mapping
run.ps1              one command: checks Ollama, starts uvicorn, prints the URL
```

`DefectAnalyzer` is an interface with one implementation (two only if Gate 0 reached rung 2). Keep the interface so the README can honestly say the runtime is swappable; do not build backends you don't need.

### 4.2 Defect taxonomy (fixed list — the model may only choose from this)

`id` | label | typical pro
---|---|---
`roof` | Roof damage (missing/curling shingles, flashing, sagging) | Roofer
`water_intrusion` | Water stains, active leak, moisture damage | Plumber or roofer (by location)
`mold_mildew` | Visible mold or mildew growth | Mold remediation
`foundation_structural` | Cracks in foundation, walls, or structural members | Structural engineer
`electrical` | Exposed wiring, scorched outlets, open panel, missing covers | Electrician
`plumbing` | Leaking/corroded pipes, fixture leaks, water heater issues | Plumber
`window_door_rot` | Rotted frames, broken glass/seals, doors that don't close | Carpenter / window installer
`pest_wood_damage` | Termite tubes, carpenter ant damage, rodent evidence | Pest control
`unclear` | Cannot determine from photo | Licensed home inspector

Store this in `assets/defect_taxonomy.json`; generate the prompt's allowed-values list from the file. Never duplicate it by hand.

### 4.3 Model output schema and grading rule

The model returns **only** this JSON. Use Ollama's `format` parameter with a JSON schema (structured output) if the installed version supports it for this model; otherwise prompt for JSON-only, strip any code fences, parse defensively, one retry on failure.

```json
{
  "defect_type": "<one id from taxonomy>",
  "severity": 1-5,
  "urgency": "immediate" | "30_days" | "1_year" | "cosmetic",
  "confidence": "high" | "medium" | "low",
  "image_quality": "ok" | "blurry" | "not_a_house",
  "reason": "<one sentence, max 20 words, describes what is visible; no cost, no legal language>"
}
```

Grading (pure functions in `grading.py`, unit-tested):
- urgency score: immediate=4, 30_days=3, 1_year=2, cosmetic=1
- risk = severity × urgency (1–20)
- letter: 1–3 → A, 4–6 → B, 7–10 → C, 11–15 → D, 16–20 → F
- **Grade range from confidence** (the "letter grade scale range" the human asked for):
  - high → single letter, e.g. "C"
  - medium → the letter and the next worse one, e.g. "C–D"
  - low → no grade; show "Can't tell — get an inspector" and set defect_type to `unclear`
- Overall grade = the **worst** confirmed finding's worst-end letter. Never an average. Print this rule verbatim in the UI info sheet and the report.

Every finding card shows: letter(s) + plain-language label ("Serious", "Urgent") + the one-line reason. Never color alone.

### 4.4 Cost table

`assets/cost_table.json`: for each `defect_type` × severity bucket (1–2, 3, 4–5) a `{low, high}` USD range. Draft all values yourself, mark the file header `"status": "PLACEHOLDER — verify before any real use"`, label the region "DC/MD/VA metro", and show every range in the UI with the caption "Estimate — varies by region and contractor." Make them plausible, round, and wide. The model never sees or produces this table.

### 4.5 Jurisdiction

The product targets the DC/Maryland/Virginia area. **Use Maryland** for the report template. Reason: Virginia's residential disclosure regime is "buyer beware" — its statutory form lists things the seller does *not* represent, so there are no itemized condition fields to map. Maryland's Residential Property Disclosure and Disclaimer Statement has itemized condition sections (roof, foundation, plumbing, electrical, water intrusion, insect damage, etc.) that map nearly one-to-one onto the taxonomy. List DC and VA as future work.

Fetch the current official Maryland form (Maryland REALTORS / Maryland Real Estate Commission), read it, and write `assets/jurisdiction_md.json` mapping each taxonomy id → form section name taken from the real document. Link to it in the README. The report is a **companion document** organized by those sections — it does not claim to be the official form. Do not reproduce form text from memory.

### 4.6 Privacy and network (state these in the README and the in-app "How this works" sheet)
- The server binds to `127.0.0.1` by default. `run.ps1 -Lan` binds `0.0.0.0` so a phone on the same Wi-Fi can open `http://<laptop-ip>:8000` for the demo; print that URL at startup. The README notes the Windows Firewall "allow on private networks" prompt.
- The backend makes exactly one kind of outbound call: to the local Ollama port. No other network calls anywhere. Add a test that greps the codebase for `http` URLs and fails on anything that isn't `127.0.0.1`/`localhost`.
- Strip EXIF (GPS, timestamps, device) with Pillow on upload, before storing or analyzing. Resize to max 1024 px on the long edge for inference (keeps latency down; note this in the inference-cost section of the README).
- Only data collected: photos, the user's confirmations/edits, optional 5-digit ZIP printed on the report. Everything lives in `data/` on the laptop. "Delete this session" wipes its photos, findings, and PDF.
- No faces, no addresses, no accounts, no analytics.

---

## 5. Guardrails (each one must be demonstrable in the video)

1. `image_quality == "blurry"` → card says "Photo too blurry — retake closer and in better light," with a Retake button. No grade.
2. `image_quality == "not_a_house"` → "This doesn't look like part of a home. Try again." No grade.
3. `confidence == "low"` → "Can't tell from this photo — recommend a licensed home inspector." No grade, pro type = home inspector.
4. Any finding graded D or F → report line adds "Recommend evaluation by a licensed [pro type]."
5. Model JSON invalid or `defect_type` not in taxonomy → one retry, then treat as `unclear`. Never crash, never show raw model text.
6. Timeout at 120 s per image → `unclear` with "Analysis timed out" and a retry button.
7. Startup check: if Ollama isn't running or the model isn't pulled, the page shows a plain-language banner with the exact command to fix it instead of failing silently.
8. The statement "AI-assisted documentation aid. Not a home inspection and not legal advice." appears on the report's every page footer, on the review screen, and on first load.

Adversarial test set in `assets/test_photos/`: at least 2 blurry, 2 non-house (a cat, a street), 1 normal undamaged wall, plus 8–10 real defects covering every taxonomy id at least once. All openly licensed (Wikimedia Commons CC, Unsplash/Pexels, or US government public domain — FEMA, HUD, EPA, NPS). Record URL + license per file in `test_photos.csv`. `scripts/run_test_set.py` runs the whole set and writes expected vs. actual, confidence, and latency to `docs/test-results.md`. That file is demo material.

---

## 6. UI (phone layout, clean, minimal)

Screens, in flow order (single-page app, one `index.html`, views toggled in JS; the URL hash tracks the view so refresh works):
1. **Welcome** — one paragraph, the disclosure statement, "Start a report," optional ZIP field.
2. **Capture** — big "Take / choose photo" button (`<input type="file" accept="image/*" capture="environment">`), thumbnails so far, "Add another angle of this problem?" nudge after each upload, "Analyze" button. Progress bar "Analyzing 2 of 5" driven by polling `/api/session/{id}/status` every 2 s. Closing and reopening the page resumes at the same session (session id in `localStorage`, wrapped in try/catch).
3. **Findings** — one card per photo: thumbnail, defect label, grade-range badge (letter + word), urgency, reason, cost range, recommended pro. Buttons: Confirm / Edit / Delete. Guardrail cards look different (grey, with Retake).
4. **Review & Report** — overall grade with the rule explained in one line, confirmed findings grouped by Maryland form section, "Generate PDF."
5. **Report** — PDF shown in an `<iframe>` with a Download button. Each finding: photo, type, grade, urgency, reason, cost range, pro recommendation. Footer disclaimer on every page.
6. **Request quote** (mock) — bottom sheet: pro type, "Request quote" → "Request sent (demo)". Nothing else.

Accessibility from the first commit, not Sunday: every image has alt text; grade badges carry `aria-label` like "Grade C to D, Serious"; 4.5:1 contrast; 44 px touch targets; the whole flow works with keyboard only and with a screen reader (test with Windows Narrator); no information carried by color alone; text scales with browser zoom to 200% without clipping; visible focus rings.

Visual style: white background, one accent color, large type, generous whitespace, system font stack. No gradients, no illustrations, no animations beyond the progress bar.

---

## 7. Phased build with verification

Each phase ends with a commit and a line in `docs/decisions.md`. Do not start the next phase until the current one's checks pass in a real browser.

**Phase 1 — Skeleton (after Gate 0 passes)**
- `LICENSE` (Apache-2.0), `README.md` stub, `.gitignore` (`data/`, `.venv/`, `__pycache__/`), `docs/`, `requirements.txt`, `run.ps1`.
- FastAPI app serving `static/index.html` with the Welcome view. Startup check for Ollama + model.
- Check: `.\run.ps1` starts the server, the page loads at the printed URL, and DevTools device mode shows it correctly at 390 px.

**Phase 2 — Inference core**
- `DefectAnalyzer` + Ollama implementation, taxonomy JSON, prompt built from taxonomy, JSON parsing with retry, image resize + EXIF strip.
- Iterate on the prompt with `scripts/gate0_ollama.py` before wiring the UI.
- Check: 5 real-defect photos and 2 non-house photos return valid JSON; latency recorded in `docs/test-results.md`.

**Phase 3 — Grading, costs, data, queue**
- Grading functions + pytest (every risk→letter boundary, every confidence case, overall = worst). Cost table + lookup + tests. SQLite schema. Background worker thread that drains the pending queue.
- Check: tests green; start an analysis, close the tab, reopen — it finished anyway.

**Phase 4 — UI flow**
- Capture → Findings → Review, with confirm/edit/delete.
- Check: a 3-photo session goes from upload to a confirmed findings list with keyboard only and with Narrator on; then repeat on a phone over Wi-Fi.

**Phase 5 — Report**
- Maryland mapping JSON, ReportLab PDF, iframe viewer + download, mock quote sheet.
- Check: PDF opens in the iframe, footer on every page, findings grouped by section, download works.

**Phase 6 — Guardrails + adversarial set + docs**
- All eight guardrails, full test-photo run, `docs/test-results.md` table, README complete (§8), accessibility pass, no-network test.
- Check: every guardrail triggerable on demand from a known test photo (needed for the video).

**Feature freeze: Sunday 10:00 AM.** After that: bug fixes only, record the video, submit by 12:00 (deadline 12:30, no grace).

---

## 8. README must contain (judges read this; it is the Documentation & Maintenance score)

1. One-paragraph problem statement + who it's for.
2. Screenshots or a short GIF of the flow in phone layout.
3. "What the AI does and never does": classifies into 9 fixed types, rates severity/urgency/confidence, writes one sentence. Never: dollar figures, legal conclusions, a grade when unsure.
4. The grading rule, verbatim.
5. Guardrails list with a screenshot of each.
6. Privacy: localhost by default, only outbound call is local Ollama, EXIF stripped, delete button; the LAN flag explained.
7. Setup for Windows (PowerShell commands): Python, Ollama install, `ollama pull <tag>`, `pip install -r requirements.txt`, `.\run.ps1`. Tested laptop specs + measured latency per photo + model size.
8. Architecture diagram (Mermaid) showing the single `DefectAnalyzer` boundary and the local Ollama box.
9. Deployment path for a nonprofit: one laptop, one install script, no API keys, no monthly cost; on-device (LiteRT-LM) as the next step, stated as future work.
10. Jurisdiction note: Maryland sections used, link to the official form, DC/VA as future work.
11. Test photo sources + licenses (link to `test_photos.csv`) and the results table.
12. What the real user said (`docs/user-interview.md`) and two personas.
13. Known limitations, honestly: single model, no fine-tuning, cost table is placeholder, one state, not an inspection, runs on a laptop not a phone.
14. License + Gemma Terms of Use note for the weights (weights are not in the repo).

---

## 9. Rules for Claude Code

- Never invent dollar amounts, legal text, form field names, statistics, or user quotes. If a value is needed and unknown, write `PLACEHOLDER` and list it in `docs/decisions.md` under "Human must fill."
- Never add a cloud call, API key, analytics, or third-party endpoint. The no-network test enforces this.
- Never add a feature not in §1. If something seems necessary, ASK with a one-line cost/benefit.
- Windows specifics: use `pathlib` everywhere, never hard-coded slashes; give commands in PowerShell form in the README; don't require WSL; test `run.ps1` from a fresh PowerShell window.
- Commit after every phase with a message naming the phase and push, so the public history shows the work happened this weekend.
- When the model side fails (vision not working, OOM, >120 s), report exact numbers and ASK rather than silently reducing scope.
- Keep the prompt in `inference/prompts.py` with a version number in a comment; log which version produced each row of `docs/test-results.md`.
- Prefer targeted edits over rewriting files that already work.
- Write the README section for each phase as you finish the phase, not at the end.

---

## 10. Open items for the human (not for Claude Code)

- Talk to one real person today (realtor, someone who sold a house, landlord) and put 5–10 lines in `docs/user-interview.md`. Worth up to 15 rubric points; no code can earn it.
- Review `assets/cost_table.json` numbers before the video.
- If Gate 0 reaches rung 2, create a Hugging Face account and accept the Gemma terms when Claude Code asks.
- Confirm with an organizer that "Best Use of Gemma 4" is the one MLH track for your submission.
- Decide who records the video; do one clean rehearsal run including one guardrail case, ideally with a phone on Wi-Fi hitting the laptop so it reads as a phone app.
