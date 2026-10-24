# Disclosure

Selling a home in Maryland means telling the buyer about problems you know of, and most sellers do not know how to document them. Disclosure is a seller-side tool: photograph a defect, get a first-pass classification from a local AI model, confirm or correct it, and produce a PDF disclosure report organized by the sections of Maryland's seller disclosure form.

It is built for home sellers in the DC/Maryland/Virginia area. The AI runs on your own computer. Nothing is uploaded.

> **AI-assisted documentation aid. Not a home inspection and not legal advice.**

## Status

The app, grading, cost lookup, queue, PDF report and all guardrails are built and tested. **Not yet run against real Gemma 4**: that needs the demo machine (see [Setup](#setup-windows)). Items still to fill are listed in [`docs/decisions.md`](docs/decisions.md) under "Human must fill".

Screenshots: PLACEHOLDER (add after the first run on the demo machine).

## What the AI does and never does

- **Does:** looks at one photo and picks one of 9 fixed types (roof, water intrusion, mold, foundation or structural, electrical, plumbing, window or door, pests or wood damage, unclear). Rates severity (1-5), urgency and its own confidence. Writes one sentence about what is visible.
- **Never:** writes dollar amounts, gives legal conclusions, or gives a grade when it is unsure. Cost ranges come from a hand-built table the model never sees. Nothing goes in the report until you confirm it.

## The grading rule

Risk = severity × urgency (immediate 4, within 30 days 3, within a year 2, cosmetic 1).

| Risk | Letter |
|---|---|
| 1-3 | A (Minor) |
| 4-6 | B (Moderate) |
| 7-10 | C (Serious) |
| 11-15 | D (Urgent) |
| 16-20 | F (Critical) |

Confidence sets the width of the grade: high shows one letter ("C"), medium shows the letter and the next worse one ("C–D"), low shows no grade and says "Can't tell — get an inspector".

> The overall grade is the worst grade among your confirmed findings. It is never an average.

## Guardrails

1. Blurry photo: "Photo too blurry — retake closer and in better light." No grade.
2. Not a house: "This doesn't look like part of a home. Try again." No grade.
3. Low confidence: "Can't tell from this photo — recommend a licensed home inspector." No grade.
4. Any finding graded D or F adds "Recommend evaluation by a licensed [pro]" to the report.
5. Invalid model output gets one retry, then becomes "unclear". The app never shows raw model text.
6. Timeout after 120 s per photo shows "Analysis timed out" with a Retry button.
7. If Ollama is not running or the model is not downloaded, a banner shows the exact command to fix it.
8. The disclaimer appears on first load, on the review screen, and in the footer of every PDF page.

Screenshots of each: PLACEHOLDER.

## Privacy

- The server listens on `127.0.0.1` only. `.\run.ps1 -Lan` listens on all interfaces so a phone on the same Wi-Fi can open the app. Windows Firewall will ask: allow it on private networks only.
- The only outbound call is to the local Ollama server. A test (`tests/test_no_network.py`) fails if any other address appears in the code.
- Photo metadata (GPS, time, device) is stripped on upload. Photos are resized to 1024 px on the long edge, which also keeps analysis fast.
- Data kept: photos, your confirmations and edits, and an optional 5-digit ZIP printed on the report. All of it lives in `data/` on this computer. "Delete this session" erases it.
- No accounts, no analytics, no faces or addresses collected.

## Setup (Windows)

```powershell
# 1. Python 3.11+ and Git are required. Install Ollama from ollama.com.
# 2. Download the model. Use the smallest vision-capable Gemma 4 tag from the Ollama library:
ollama pull <tag>
$env:DISCLOSURE_MODEL = "<tag>"

# 3. Get the code and start it
git clone https://github.com/ben-robles/disclosure
cd disclosure
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\run.ps1            # http://127.0.0.1:8000
.\run.ps1 -Lan       # also prints a URL for a phone on the same Wi-Fi
```

Check that Gemma sees images first: `.\.venv\Scripts\python scripts\gate0_ollama.py <tag> photo.jpg`.

Tested laptop specs, model size and measured latency per photo: PLACEHOLDER.

Settings (environment variables): `DISCLOSURE_MODEL`, `DISCLOSURE_WORKERS` (photos analyzed at once, default 4; match Ollama's `OLLAMA_NUM_PARALLEL`), `DISCLOSURE_KEEP_ALIVE`, `DISCLOSURE_TIMEOUT_S`, `DISCLOSURE_DATA_DIR`.

Tests: `.\.venv\Scripts\python -m pytest`. To try the UI without Gemma: `.\.venv\Scripts\python -m tests.dev_server` (canned fake answers, http://127.0.0.1:8001).

## Architecture

```mermaid
flowchart LR
  Browser["Phone-layout web UI"] --> API["FastAPI app"]
  API --> DB[("SQLite + photos in data/")]
  API --> Q["Background worker threads"]
  Q --> DA["DefectAnalyzer (one interface)"]
  DA --> OL["Local Ollama + Gemma 4"]
  API --> G["grading.py + costs.py"]
  API --> PDF["ReportLab PDF"]
```

Everything that touches the model is behind `DefectAnalyzer` (`app/inference/`). Swapping the runtime means writing one other class.

## Deployment path for a nonprofit

One laptop, one install, no API keys, no monthly cost. Gemma 4 has official on-device runtimes (LiteRT-LM for Android and iOS), so a phone build is the next step. **It is future work: today the model runs on the laptop, not on a phone.**

## Jurisdiction

The report is a companion document organized by the numbered questions of the [Maryland Residential Property Disclosure and Disclaimer Statement](https://labor.md.gov/forms/propertydanddform.pdf) (printed revision "Rev August 3, 2026"). Foundation, roof, plumbing, electrical and wood-destroying insects map to their own questions. Water intrusion, mold and window or door damage have no matching question and are listed under question 25 (other material defects). It does not replace the official form. DC and Virginia are future work (Virginia's regime is buyer-beware, so its form has no itemized conditions to map).

## Test photos and results

PLACEHOLDER: add photos to `assets/test_photos/` with sources and licenses in `test_photos.csv`, then run `scripts\run_test_set.py`. Results go to `docs/test-results.md`.

## The user

PLACEHOLDER: see [`docs/user-interview.md`](docs/user-interview.md) and [`docs/personas.md`](docs/personas.md).

## Known limitations

- One model, no fine-tuning, one photo per finding.
- Not yet measured on real Gemma 4: accuracy and latency are unknown.
- The cost table is placeholder data.
- One state (Maryland).
- Not an inspection. Runs on a laptop, not a phone.

## License

Code: Apache-2.0 (see `LICENSE`). The Gemma 4 weights are not in this repository and are covered by Google's Gemma Terms of Use. Check them before you redistribute or deploy.
