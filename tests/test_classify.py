import json

import pytest

from app import classify as classifier
from app import config
from app.db import Database
from app.inference.analyzer import Finding
from app.inference.judge import NONE_OF_THESE, OK, UNAVAILABLE, NullJudge, TypeChoice
from app.inference.ollama_analyzer import ParseError, parse_model_output
from app.inference.prompts import build_prompt, output_schema, prompt_version
from app.queue import Worker
from tests.fake_analyzer import FakeAnalyzer
from tests.fake_judge import FakeJudge

V4_REPLY = {"reason": "Curling shingles along the roof edge.", "title": "Curling shingles",
            "severity": 3, "urgency": "1_year", "image_quality": "ok"}


def described(**kw):
    """What the v4 parser hands the classifier: a description with no type yet."""
    base = dict(defect_type="unclear", severity=3, urgency="1_year", confidence="low",
                image_quality="ok", reason="Curling shingles along the roof edge.",
                title="Curling shingles")
    base.update(kw)
    return Finding(**base)


def choice(top):
    return FakeJudge(choice=TypeChoice(OK, top))


@pytest.mark.parametrize("p, expected", [(0.9, "high"), (0.75, "high"), (0.6, "medium"), (0.45, "medium")])
def test_top_probability_sets_confidence(p, expected):
    f = classifier.classify_finding(choice([("roof", p), ("plumbing", 0.1)]), described())
    assert (f.defect_type, f.confidence) == ("roof", expected)
    assert f.judge_status == "ok" and f.judge_top == [["roof", p], ["plumbing", 0.1]]


def test_below_medium_is_unclear_low():
    f = classifier.classify_finding(choice([("roof", 0.44)]), described())
    assert (f.defect_type, f.confidence) == ("unclear", "low")


def test_none_of_these_is_unclear_even_when_confident():
    f = classifier.classify_finding(choice([(NONE_OF_THESE, 0.95), ("roof", 0.02)]), described())
    assert (f.defect_type, f.confidence) == ("unclear", "low")


def test_thresholds_are_tunable():
    f = classifier.classify_finding(choice([("roof", 0.6)]), described(), high=0.5, medium=0.2)
    assert f.confidence == "high"


def test_judge_unavailable_never_grades_without_a_type():
    f = classifier.classify_finding(FakeJudge(down=True), described())
    assert (f.analysis_status, f.defect_type, f.reason) == ("unavailable", "unclear", "The AI model is not reachable.")
    assert f.judge_status == UNAVAILABLE


def test_blurry_and_not_a_house_are_not_classified():
    judge = FakeJudge()
    for q in ("blurry", "not_a_house"):
        f = classifier.classify_finding(judge, described(image_quality=q))
        assert f.defect_type == "unclear"
    assert judge.calls == []


def test_judge_sees_only_gemmas_text():
    judge = FakeJudge()
    classifier.classify_finding(judge, described())
    assert judge.calls == [("classify", ("Curling shingles along the roof edge.", "Curling shingles"))]


def test_active_needs_flag_and_real_judge(monkeypatch):
    monkeypatch.setattr(config, "JUDGE_CLASSIFY", True)
    assert classifier.active(FakeJudge()) and not classifier.active(NullJudge())
    monkeypatch.setattr(config, "JUDGE_CLASSIFY", False)
    assert not classifier.active(FakeJudge())


# ---- Gemma prompt v4 and its parser --------------------------------------------------------

def test_v4_prompt_has_no_type_or_confidence_fields():
    p = build_prompt(classify=True)
    assert "defect_type" not in p and "confidence" not in p and "category_fits" not in p
    assert "defect_type" in build_prompt() and prompt_version(True) == "v4" and prompt_version() == "v3"


def test_v4_schema_drops_three_fields_and_v3_is_untouched():
    schema = output_schema(classify=True)
    assert set(schema["properties"]) == {"reason", "title", "severity", "urgency", "image_quality"}
    assert set(schema["required"]) == set(schema["properties"])
    assert {"defect_type", "confidence", "category_fits"} <= set(output_schema()["properties"])


def test_v4_reply_parses_without_type_and_v3_parser_still_rejects_it():
    f = parse_model_output(json.dumps(V4_REPLY), classify=True)
    assert (f.defect_type, f.confidence, f.category_fits) == ("unclear", "low", True)
    assert f.reason == V4_REPLY["reason"] and f.severity == 3
    with pytest.raises(ParseError):
        parse_model_output(json.dumps(V4_REPLY))


def test_v4_still_validates_remaining_fields():
    with pytest.raises(ParseError):
        parse_model_output(json.dumps({**V4_REPLY, "severity": 9}), classify=True)


# ---- worker -------------------------------------------------------------------------------

def run_worker(tmp_path, judge, classify=True, verify=False, finding=None):
    db = Database(tmp_path / "w.sqlite3")
    sid = db.create_session()
    pid = db.add_photo(sid)
    db.mark_pending(sid)
    w = Worker(db, FakeAnalyzer([finding or described()]), lambda p: b"x",
               judge=judge, verify=verify, classify=classify)
    assert w.run_once()
    return db.get_finding(pid)


def test_worker_grades_from_the_judges_choice(tmp_path):
    row = run_worker(tmp_path, choice([("roof", 0.9), ("water_intrusion", 0.06), ("mold_mildew", 0.02)]))
    assert (row["defect_type"], row["confidence"], row["judge_status"]) == ("roof", "high", "ok")
    assert json.loads(row["judge_top"])[0] == ["roof", 0.9]
    assert len(json.loads(row["judge_top"])) == 3


def test_worker_unavailable_judge_means_retry_not_a_grade(tmp_path):
    row = run_worker(tmp_path, FakeJudge(down=True))
    assert row["analysis_status"] == "unavailable" and row["defect_type"] == "unclear"


def test_worker_survives_a_judge_that_raises(tmp_path):
    class Boom(FakeJudge):
        def classify(self, reason, title):
            raise RuntimeError("boom")
    row = run_worker(tmp_path, Boom())
    assert row["analysis_status"] == "unavailable"


def test_classify_off_leaves_gemmas_type_alone(tmp_path):
    judge = FakeJudge()
    row = run_worker(tmp_path, judge, classify=False, finding=described(defect_type="plumbing", confidence="high"))
    assert row["defect_type"] == "plumbing" and judge.calls == []


def test_classify_then_verify_compose(tmp_path):
    row = run_worker(tmp_path, choice([("roof", 0.9)]), verify=True)
    assert row["defect_type"] == "roof" and row["judge_status"] == "ok" and row["judge_label_p"] == 0.9
