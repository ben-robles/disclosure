# Disclosure: phone-screen prototype

A clickable design prototype of the full Disclosure flow, built in a phone layout (390 px wide, centered in a 430 px column on bigger screens). Everything is saved on the device. Photo analysis is a placeholder that returns sample findings, with one clear spot where your Gemma 4 call goes in later.

## Screens (in order)
1. **Welcome**: short intro, the disclaimer "AI-assisted documentation aid. Not a home inspection and not legal advice.", an optional ZIP field, and a "Start a report" button.
2. **Capture**: a big "Take / choose photo" button (opens the camera on a phone), photo thumbnails, an "Add another angle of this problem?" prompt after each upload, an Analyze button, and an "Analyzing 2 of 5" progress bar.
3. **Findings**: one card per photo showing the thumbnail, defect type, grade badge (letter plus a word like "Serious"), urgency, one-line reason, cost range with the caption "Estimate — varies by region and contractor.", and the recommended pro. Each card has Confirm, Edit (type and severity) and Delete. Problem cards (blurry, not a house, low confidence, timed out) are grey and have a Retake button.
4. **Review**: the overall grade with the "worst finding, never an average" rule, confirmed findings grouped by Maryland form section (names marked PLACEHOLDER), and a "Generate report" button.
5. **Report**: a printable report page with a Download PDF button and the disclaimer at the foot of every page.
6. **Request quote**: a panel that slides up from the bottom with the pro type. "Request quote" shows "Request sent (demo)" and does nothing else.
7. **How this works**: an info panel with the grading rule and privacy notes. There is also a "Delete this session" button.

The screen you're on shows in the web address, so refreshing keeps you in place and reopening the app picks the session back up.

## Rules taken from the spec
- Grading: urgency score (immediate 4, 30 days 3, 1 year 2, cosmetic 1) × severity gives a risk score. Risk 1–3 is A, 4–6 B, 7–10 C, 11–15 D, 16–20 F.
- Confidence: high shows one letter. Medium shows a range ("C–D"). Low shows no grade and says "Can't tell — get an inspector".
- Overall grade is the worst confirmed finding.
- D or F findings add "Recommend evaluation by a licensed [pro]."
- The fixed list of 9 defect types and their pros, exactly as in your spec.
- Cost table for DC/MD/VA marked "PLACEHOLDER — verify before any real use". The AI never produces dollar amounts.
- Accessibility: alt text on images, spoken labels on grade badges, 44 px tap targets, visible focus rings, keyboard-only use, and color never used as the only signal.
- Style: white background, one accent color (deep teal), large system-font text, no gradients and no animations apart from the progress bar.

## Technical details
- Built with TanStack routes, one per screen: `/`, `/capture`, `/findings`, `/review`, `/report`. The quote panel and info panel open on top of the current screen.
- `src/lib/disclosure/`
  - `taxonomy.ts`
  - `grading.ts` (pure functions)
  - `costs.ts`
  - `jurisdiction.ts` (placeholder Maryland section names)
  - `analyzer.ts`: a `DefectAnalyzer` interface plus a `mockAnalyzer` that returns findings in the spec's schema with a small delay. It cycles through every guardrail case so each one can be shown.
  - `store.ts`: the session is saved in the browser (wrapped in try/catch); photos are saved as resized data URLs (max 1024 px).
- Parsing that checks the model's JSON against the schema, so a bad defect type becomes `unclear`. Real Gemma output can go through it later.
- PDF made in the browser with jsPDF, shown in an iframe, with the disclaimer footer on each page.
- Vitest tests for every risk-to-letter boundary, each confidence case, overall = worst, cost lookup, and parsing.
- Each route gets its own page title and description.
- `AGENTS.md` notes that the analyzer is the single swap point for the model.
