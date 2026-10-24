# Disclosure prototype

- All model calls go through `DefectAnalyzer` in `src/lib/disclosure/analyzer.ts`; swap `analyzer` there to plug in Gemma 4 — nothing else may touch the model. Why: single swap point.
- Grading, costs, taxonomy and parsing are pure modules with tests in `src/lib/disclosure/disclosure.test.ts`. Why: rules must stay verifiable.
- Session state lives in the browser (localStorage) via `store.ts`; no backend. Why: design prototype, on-device only.
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
