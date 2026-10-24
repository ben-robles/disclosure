# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

First-time home sellers in Maryland (DC/MD/VA area): non-experts, often anxious about liability, working on their own phone inside their own house, in uneven indoor light. Secondary audience for now: hackathon judges (GDG AI for Housing challenge) who evaluate it in a short demo, so it must read as a real, finished product in two minutes as well as work for a seller.

## Product Purpose

Selling a home in Maryland means disclosing defects you know about, and most sellers do not know how to document them. Disclosure lets a seller photograph a defect, get a first-pass classification from a local AI model (Gemma 4 via Ollama), confirm or correct it, and export a PDF organized by the sections of Maryland's seller disclosure form. Success: a seller finishes with an honest, well-organized record they are comfortable attaching to their disclosure.

## Positioning

Seller-side, on-device, and guardrailed: the AI runs on the seller's own computer and nothing is uploaded; it never writes dollar amounts or legal conclusions (cost ranges come from a hand-built table), never grades when unsure, and nothing enters the report until the seller confirms it.

## Operating Context

Phone-first, single column (~430px), with desktop shown as a centered phone-width frame. Flow: Welcome, Photos, Findings, Review, Report, plus About, FAQ, Contact, Privacy, Terms. Session state lives in the browser; no accounts, no analytics. Grade is risk = severity x urgency, mapped to A (Minor) through F (Critical); low confidence shows no grade and recommends a licensed inspector.

## Capabilities and Constraints

- Nine fixed defect types; five grades A-F; confidence widens or removes the grade.
- Mandatory disclaimer: AI-assisted documentation aid, not a home inspection and not legal advice.
- Guardrail messages (blurry, not a house, low confidence, timeout, model offline) must stay.
- The frontend is a Lovable-connected TanStack Start project in `frontend/`; do not rewrite pushed git history. Model calls go only through `DefectAnalyzer` in `src/lib/disclosure/analyzer.ts`; grading, costs, taxonomy and parsing stay pure and tested.

## Brand Commitments

Name: Disclosure. Flow and routes, and the phone-first layout, are fixed. Copy is not locked but the disclaimer and guardrail wording carry legal weight and change only for clarity. The result must feel like a polished, real website, not a template.

## Evidence on Hand

15 licensed test photos in the repo; README grading table; no testimonials, customers, usage numbers, or screenshots exist. Do not fabricate any.

## Product Principles

- Honest over impressive: never imply the AI knows more than it does.
- The seller stays in control: every finding is confirmed before it counts.
- Plain language for a stressed non-expert; large type and touch targets.
- Privacy is a feature the interface can show, not just state.

## Accessibility & Inclusion

Large touch targets, high contrast, readable at arm's length on a phone in dim rooms; keyboard focus visible; grade is never conveyed by color alone (letter always present).
