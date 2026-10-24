# Disclosure: hackathon plan and gaps

Oct 24, 2026 · @Ben

Disclosure is a seller-side tool: photograph a home's defects, get each one rated for severity and urgency with a letter safety grade, a cost range, and a printable disclosure report. Build it as a narrow, working, honest demo, because judges score proof the problem is real and guardrails on the AI (50 of 100 points) as heavily as the tech.

## Tracks to enter

| Track | Enter? | Why |
| --- | --- | --- |
| GDG Best Overall AI for Housing | Yes | Direct fit: housing, safety, transparency. |
| MLH Best Use of Gemma 4 | Yes, as the one MLH pick | Fits only if Gemma 4 does the photo analysis itself, not as an add-on. |
| MLH Best Open-Source AI Project | Probably automatic | Needs a public repo and a license file from the start. |
| MLH Best UI/UX | Only if time allows | Grade card and report flow can earn it, but the slides say not to check boxes just to enter. |
| MLH Best Use of Google Cloud | No | A local-first model contradicts it. |

**Conflict in the slides to ask an organizer about:** slide 12 says select only ONE MLH track, while slide 7 says you are judged in every track you enter. Ask whether Open-Source is added automatically on top of your one pick (slide 8 notes say it is).

## Gaps and fixes

Ten gaps, ordered by rubric points at risk. The first four decide whether you score well on Responsible AI and Problem Validation.

| # | Gap | Rubric points at risk | Fix |
| --- | --- | --- | --- |
| 1 | **Wrong or overconfident AI ratings.** A model can miss a structural crack or call mold cosmetic. | Safety and Grounding (10) | Model picks only from a fixed list of defect types. Every finding shows a confidence level and a "can't tell, get an inspector" outcome. The seller must confirm each finding. Test with blurry and non-house photos. |
| 2 | **Legal liability.** Who is responsible if "minor" turns out to be major? | Safety and Grounding (10), Feasibility (25) | Position it as a documentation aid, not an inspection. Put that statement on every report. Any finding graded D or F, or with low confidence, recommends a licensed professional. |
| 3 | **No real user yet.** The deck scores stakeholder empathy and problem definition. | Stakeholder Empathy (5), Problem Definition (10) | Talk to one real person today (a realtor, a parent who sold a home, a landlord). Write down what they said. Add two personas. |
| 4 | **Why would a seller disclose more than required?** | Impact Multiplier (10) | Frame it as protection from after-sale disputes and as proof buyers can trust. Show a buyer-facing view of the report. Do not claim numbers you can't source. |
| 5 | **Disclosure rules differ by state.** | Problem Definition (10), Deployment (10) | Pick one state (Virginia is natural for a VT demo). Build the report from that state's official disclosure form fields. List other states as future work. |
| 6 | **Cost estimates can be invented by the model.** | Safety and Grounding (10) | Costs come from a small hand-built table per defect type and severity, shown as ranges and labeled "estimate, varies by region." The model never produces dollar figures. |
| 7 | **Letter grades look precise but aren't.** | AI Integration (15), Safety (10) | Publish the rule: grade = severity × urgency, with a one-line reason per item. One overall grade is the worst item's grade, not an average. |
| 8 | **Local model may not run or be fast enough on the demo device.** | Architectural Soundness (10), Inference Cost (8) | Smoke-test Gemma 4 with image input in the first hour. Keep the model behind one function so a hosted fallback is a quick swap. |
| 9 | **Photos expose private details (faces, addresses, GPS).** | Privacy and Data Ethics (8) | Process on-device, strip photo location data, store nothing on a server, collect only photos and a ZIP or state. |
| 10 | **Accessibility and documentation left to Sunday.** | Inclusive Design (7), Documentation (7) | Never rely on color alone for grades (letter plus label). Keyboard path and alt text from the start. Write the README as you go. |

The "handoff to a professional" idea is the easiest place to lose time. In the demo, show it as a recommended pro type (for example roofer, electrician) with a mock "request quote" button, not a real integration.

## MVP scope

One flow that works end to end beats five half-built features.

**In:**

- Upload photos with a prompt for multiple angles of the same problem.
- Gemma 4 returns structured output per finding: defect type (from a fixed list of about 8), severity, urgency window (immediate, within 30 days, within a year, cosmetic), confidence, and a one-line reason.
- Safety grade A to F per item and overall, using the published rule.
- Cost range looked up from a hand-built table.
- Seller reviews, edits, or removes each finding.
- Printable disclosure report for one state, with the "AI-assisted, not an inspection" statement.
- Mock handoff: recommended professional type and a "request quote" button.

**Out:** real contractor integration, multiple states, accounts, payments, buyer-side marketplace, video input.

## Build plan

Hacking began at 11:00 AM Saturday. Submissions close at 12:30 PM Sunday, with no late submissions. Split work by person once you know team size (the slides leave the maximum blank; ask an organizer).

1. **Now to lunch (12:00 PM):** Lock the scope above. Create the public repo with an open-source license file. Smoke-test Gemma 4 locally with one photo. Talk to one real user. Claim the $25 Google Cloud credits only if you keep a fallback.
2. **Afternoon:** Build the core pipeline: photo in, structured findings out. Collect 10 to 15 test photos of real defects (your own, or openly licensed). Check results against what you know is wrong.
3. **Early evening:** Build the UI in parallel: upload, finding cards, grade, cost range, edit and confirm. Another person builds the cost table and the state report template.
4. **Evening:** Add guardrails (low confidence, non-house photo, blurry photo, "can't tell") and run the accessibility pass. Write the README as you go.
5. **Sunday 10:00 AM:** Feature freeze. Fix bugs only. Record the 2-minute demo video with a clean run.
6. **Sunday 11:00 AM to 12:30 PM:** Submit on both platforms. Aim to finish by 12:00, since there is no grace period.

## Submission and demo

One submission does not count for the other, so do both.

- [ ] Public GitHub repo with a license file and README (setup steps, dependencies)
- [ ] MLH submission in OrganizerHQ: project name, description, tech used, GitHub link, 2-minute video, ONE MLH track
- [ ] GDG Housing submission on codingjam.dev: the Virginia Tech chapter entry, with codebase, demo video, and short description
- [ ] Both submitted before 12:30 PM Sunday

**Demo, five beats (one demo is scored for every track):**

1. Problem: a first-time seller who doesn't know what to disclose.
2. Solution: photo to graded findings to report.
3. Live demo or video, including one case where the app says "can't tell, get an inspector."
4. AI and track fit: why Gemma 4 runs locally, and what it never does (costs, legal advice).
5. Impact: what the real user you spoke with said.
