import csv
import json

from app.inference.analyzer import Finding
from app.inference.judge import OK, SKIPPED, UNAVAILABLE, EvalVerdict, NullJudge
from scripts import run_test_set as rts
from tests.conftest import make_jpeg
from tests.fake_analyzer import FakeAnalyzer
from tests.fake_judge import FakeJudge

ROOF = Finding("roof", 3, "1_year", "high", "ok", "Curling shingles on the roof.", title="Roof damage")
BLUR = Finding("unclear", 1, "cosmetic", "low", "blurry", "Too blurry to judge.")


def setup(tmp_path, rows):
    photos = tmp_path / "photos"
    photos.mkdir()
    fields = ["file", "expected", "expected_details"]
    with (photos / "test_photos.csv").open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        (photos / r["file"]).write_bytes(make_jpeg((64, 64)))
    return photos


def run(tmp_path, rows, findings, judge):
    photos = setup(tmp_path, rows)
    out = tmp_path / "results.md"
    result = rts.run(FakeAnalyzer(findings), judge, photos=photos, out=out, eval_dir=tmp_path / "eval")
    return result, out.read_text(encoding="utf-8")


ROWS = [
    {"file": "a.jpg", "expected": "roof", "expected_details": "curling shingles"},
    {"file": "b.jpg", "expected": "blurry", "expected_details": ""},
]


def test_defect_row_judged_guardrail_row_not(tmp_path):
    judge = FakeJudge(evaluation=EvalVerdict(OK, 0.8, 0.6))
    (hits, total, scored, _), text = run(tmp_path, ROWS, [ROOF, BLUR], judge)
    assert (hits, total, scored) == (2, 2, 1)
    assert len(judge.calls) == 1
    kind, state = judge.calls[0]
    assert kind == "evaluate"
    assert state["model_reason"] == ROOF.reason and state["expected_details"] == "curling shingles"
    assert state["expected_defect_type"]["id"] == "roof"
    assert "| yes | 0.80 | 0.60 | ok |" in text
    assert "| yes |  |  | skipped |" in text
    assert "mean mentions_expected_p 0.80" in text and "regression harness" in text and "v3" in text


def test_raw_json_kept_per_photo(tmp_path):
    run(tmp_path, ROWS, [ROOF, BLUR], FakeJudge())
    files = sorted((next((tmp_path / "eval").iterdir())).glob("*.json"))
    assert [f.stem for f in files] == ["a", "b"]
    data = json.loads(files[0].read_text(encoding="utf-8"))
    assert data["finding"]["defect_type"] == "roof" and data["judge"]["status"] == OK


def test_no_judge_still_scores_exact_match(tmp_path):
    (hits, _, scored, _), text = run(tmp_path, ROWS, [ROOF, BLUR], NullJudge())
    assert hits == 2 and scored == 0
    assert "n/a" in text and SKIPPED in text


def test_judge_down_leaves_row_with_unavailable(tmp_path):
    (_, _, scored, _), text = run(tmp_path, ROWS, [ROOF, BLUR], FakeJudge(down=True))
    assert scored == 0 and UNAVAILABLE in text


def test_classify_run_has_its_own_section_beside_v3(tmp_path):
    from app.inference.judge import TypeChoice
    photos = setup(tmp_path, ROWS[:1])
    out = tmp_path / "results.md"
    kw = dict(photos=photos, out=out, eval_dir=tmp_path / "eval")
    rts.run(FakeAnalyzer([ROOF]), FakeJudge(), **kw)
    described = Finding("unclear", 3, "1_year", "low", "ok", "Curling shingles on the roof.", title="Roof damage")
    judge = FakeJudge(choice=TypeChoice(OK, [("plumbing", 0.9)]))
    hits, *_ = rts.run(FakeAnalyzer([described]), judge, classify=True, **kw)
    text = out.read_text(encoding="utf-8")
    assert hits == 0  # the judge picked the wrong type, and the harness says so
    assert text.count("## Prompt ") == 2 and text.index("## Prompt v3") < text.index("## Prompt v4")
    assert text.count("# Test results") == 1 and text.count("regression harness") == 1
    assert "(exact_match): 1 of 1" in text and "(exact_match): 0 of 1" in text


def test_rerun_replaces_only_its_own_section(tmp_path):
    photos = setup(tmp_path, ROWS[:1])
    out = tmp_path / "results.md"
    kw = dict(photos=photos, out=out, eval_dir=tmp_path / "eval")
    rts.run(FakeAnalyzer([ROOF]), FakeJudge(), **kw)
    rts.run(FakeAnalyzer([ROOF]), FakeJudge(), **kw)
    assert out.read_text(encoding="utf-8").count("## Prompt v3") == 1


TIMEOUT = Finding("unclear", 1, "cosmetic", "low", "ok", "Analysis timed out.", "timeout")


def test_timeout_gets_one_more_try(tmp_path):
    analyzer = FakeAnalyzer([TIMEOUT, ROOF])
    photos = setup(tmp_path, ROWS[:1])
    hits, *_ = rts.run(analyzer, NullJudge(), photos=photos, out=tmp_path / "r.md", eval_dir=tmp_path / "eval")
    assert hits == 1 and analyzer.calls == 2


def test_warm_up_call_is_not_scored(tmp_path):
    analyzer = FakeAnalyzer([ROOF])
    photos = setup(tmp_path, ROWS[:1])
    hits, total, *_ = rts.run(analyzer, NullJudge(), photos=photos, out=tmp_path / "r.md",
                              eval_dir=tmp_path / "eval", warm=True)
    assert (hits, total) == (1, 1) and analyzer.calls == 2


def test_verify_run_moves_category_and_has_its_own_section(tmp_path):
    from app.inference.judge import TypeChoice, Verdict
    wrong = Finding("water_intrusion", 3, "30_days", "high", "ok", "Curling shingles on the roof.",
                    title="Roof damage")
    judge = FakeJudge(verdict=Verdict(OK, 0.1, 0.9, 0.1), choice=TypeChoice(OK, [("roof", 0.9)]))
    photos = setup(tmp_path, ROWS[:1])
    out = tmp_path / "r.md"
    kw = dict(photos=photos, out=out, eval_dir=tmp_path / "eval")
    plain, *_ = rts.run(FakeAnalyzer([wrong]), judge, **kw)
    fixed, *_ = rts.run(FakeAnalyzer([wrong]), judge, verify=True, **kw)
    text = out.read_text(encoding="utf-8")
    assert (plain, fixed) == (0, 1)
    assert "## Prompt v3.3+verify" in text and "## Prompt v3.3\n" in text
