"""Run every photo in assets/test_photos/ through the real analyzer and write docs/test-results.md.

    .venv\\Scripts\\python scripts\\run_test_set.py

Reads assets/test_photos/test_photos.csv (columns: file, expected, source_url, license).
`expected` is a taxonomy id, or `blurry` / `not_a_house` / `normal` for the guardrail photos.
"""
import csv
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import config  # noqa: E402
from app.images import sanitize  # noqa: E402
from app.inference.ollama_analyzer import OllamaAnalyzer  # noqa: E402
from app.inference.prompts import PROMPT_VERSION  # noqa: E402

PHOTOS = ROOT / "assets" / "test_photos"
OUT = ROOT / "docs" / "test-results.md"


def matches(expected: str, f) -> bool:
    if expected == "blurry":
        return f.image_quality == "blurry"
    if expected == "not_a_house":
        return f.image_quality == "not_a_house"
    if expected == "normal":
        return f.defect_type == "unclear" or f.severity <= 1
    return f.defect_type == expected and f.image_quality == "ok"


def main() -> int:
    csv_path = PHOTOS / "test_photos.csv"
    if not csv_path.exists():
        print(f"Missing {csv_path}. Add photos and the CSV first (see assets/test_photos/README.md).")
        return 1
    analyzer = OllamaAnalyzer()
    status = analyzer.status()
    if not status["ready"]:
        print(status["message"], "Run:", status["fix"])
        return 1

    rows, hits = [], 0
    with csv_path.open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            image = sanitize((PHOTOS / r["file"]).read_bytes())
            t0 = time.time()
            f = analyzer.analyze(image)
            dt = time.time() - t0
            ok = matches(r["expected"], f)
            hits += ok
            rows.append(f"| {r['file']} | {r['expected']} | {f.defect_type} | {f.severity} | "
                        f"{f.urgency} | {f.confidence} | {f.image_quality} | {dt:.1f} s | "
                        f"{'yes' if ok else 'NO'} |")

    lines = [
        "# Test results", "",
        f"- Prompt version: {PROMPT_VERSION}",
        f"- Model tag: {config.MODEL}",
        f"- Run: {time.strftime('%Y-%m-%d %H:%M')}",
        f"- Matched expected: {hits} of {len(rows)}", "",
        "| photo | expected | got | severity | urgency | confidence | quality | latency | match |",
        "|---|---|---|---|---|---|---|---|---|",
        *rows, "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT} ({hits}/{len(rows)} matched)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
