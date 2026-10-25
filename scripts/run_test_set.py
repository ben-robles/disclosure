"""Run every photo in assets/test_photos/ through the real analyzer and write docs/test-results.md.

    .venv\\Scripts\\python scripts\\run_test_set.py [--no-judge]

Reads assets/test_photos/test_photos.csv (columns: file, expected, ..., expected_details).
`expected` is a taxonomy id, or `blurry` / `not_a_house` / `normal` for the guardrail photos.
`expected_details` is a short phrase for what is visibly wrong; guardrail rows leave it empty.

With a TypeSafe key (see .env.example) a text-only judge also scores whether Gemma's words match
the expected details. Pass --no-judge to skip it. Only Gemma's text goes to the judge, never a photo.
"""
import argparse
import csv
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import config  # noqa: E402
from app.images import sanitize  # noqa: E402
from app.inference.judge import OK, SKIPPED, EvalVerdict, NullJudge, build_judge  # noqa: E402
from app.inference.ollama_analyzer import OllamaAnalyzer  # noqa: E402
from app.inference.prompts import PROMPT_VERSION, load_taxonomy  # noqa: E402

PHOTOS = ROOT / "assets" / "test_photos"
OUT = ROOT / "docs" / "test-results.md"
EVAL_DIR = ROOT / "data" / "eval"
GUARDRAILS = ("blurry", "not_a_house", "normal")
CAVEAT = ("About 15 photos: a regression harness, not a validation study. "
          "Judge scores are probabilities from a text-only model reading Gemma's words.")


def matches(expected: str, f) -> bool:
    if expected == "blurry":
        return f.image_quality == "blurry"
    if expected == "not_a_house":
        return f.image_quality == "not_a_house"
    if expected == "normal":
        return f.defect_type == "unclear" or f.severity <= 1
    return f.defect_type == expected and f.image_quality == "ok"


def judge_row(judge, r: dict, f) -> EvalVerdict:
    """Score Gemma's words for a defect photo. Guardrail rows are checked on quality only."""
    if r["expected"] in GUARDRAILS or not r.get("expected_details") or f.analysis_status != "ok":
        return EvalVerdict(SKIPPED)
    entry = next(d for d in load_taxonomy() if d["id"] == r["expected"])
    return judge.evaluate({
        "model_reason": f.reason,
        "model_title": f.title,
        "model_defect_type": f.defect_type,
        "expected_defect_type": {"id": entry["id"], "label": entry["label"],
                                 "look_for": entry["look_for"]},
        "expected_details": r["expected_details"],
    })


def _p(value) -> str:
    return "" if value is None else f"{value:.2f}"


def _mean(values) -> str:
    values = [v for v in values if v is not None]
    return f"{sum(values) / len(values):.2f}" if values else "n/a"


def run(analyzer, judge, csv_path=None, photos=PHOTOS, out=OUT, eval_dir=EVAL_DIR, now=None):
    now = now or time.time()
    run_dir = Path(eval_dir) / f"{time.strftime('%Y%m%d-%H%M%S', time.localtime(now))}-{PROMPT_VERSION}"
    run_dir.mkdir(parents=True, exist_ok=True)
    rows, hits, verdicts = [], 0, []
    with Path(csv_path or Path(photos) / "test_photos.csv").open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            image = sanitize((Path(photos) / r["file"]).read_bytes())
            t0 = time.time()
            f = analyzer.analyze(image)
            dt = time.time() - t0
            v = judge_row(judge, r, f)
            ok = matches(r["expected"], f)
            hits += ok
            verdicts.append(v)
            (run_dir / f"{Path(r['file']).stem}.json").write_text(json.dumps({
                "file": r["file"], "expected": r["expected"],
                "expected_details": r.get("expected_details", ""), "exact_match": ok,
                "finding": vars(f), "judge": vars(v), "latency_s": round(dt, 2),
            }, indent=2), encoding="utf-8")
            rows.append(f"| {r['file']} | {r['expected']} | {f.defect_type} | {f.severity} | "
                        f"{f.urgency} | {f.confidence} | {f.image_quality} | {dt:.1f} s | "
                        f"{'yes' if ok else 'NO'} | {_p(v.mentions_expected)} | "
                        f"{_p(v.type_consistent)} | {v.status} |")

    scored = [v for v in verdicts if v.status == OK]
    lines = [
        "# Test results", "",
        CAVEAT, "",
        f"- Prompt version: {PROMPT_VERSION}",
        f"- Model tag: {config.MODEL}",
        f"- Run: {time.strftime('%Y-%m-%d %H:%M', time.localtime(now))}",
        f"- Matched expected (exact_match): {hits} of {len(rows)}",
        f"- Judge: {len(scored)} photos scored; mean mentions_expected_p "
        f"{_mean(v.mentions_expected for v in scored)}, mean type_consistent_p "
        f"{_mean(v.type_consistent for v in scored)} (prompt {PROMPT_VERSION})",
        f"- Raw per-photo JSON: {run_dir.relative_to(ROOT) if run_dir.is_relative_to(ROOT) else run_dir}", "",
        "| photo | expected | got | severity | urgency | confidence | quality | latency "
        "| exact_match | mentions_expected_p | type_consistent_p | judge_status |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
        *rows, "",
    ]
    Path(out).write_text("\n".join(lines), encoding="utf-8")
    return hits, len(rows), len(scored), Path(out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--no-judge", action="store_true", help="skip the TypeSafe text judge")
    args = ap.parse_args(argv)

    csv_path = PHOTOS / "test_photos.csv"
    if not csv_path.exists():
        print(f"Missing {csv_path}. Add photos and the CSV first (see assets/test_photos/README.md).")
        return 1
    analyzer = OllamaAnalyzer()
    status = analyzer.status()
    if not status["ready"]:
        print(status["message"], "Run:", status["fix"])
        return 1
    judge = NullJudge() if args.no_judge else build_judge()
    if not args.no_judge and not judge.enabled:
        print("Judge off (set DISCLOSURE_TYPESAFE_URL and TYPESAFE_API_KEY, or pass --no-judge).")

    hits, total, scored, out = run(analyzer, judge)
    print(f"Wrote {out} ({hits}/{total} matched, {scored} judged)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
