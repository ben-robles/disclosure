import sqlite3

from app.db import Database
from app.inference.analyzer import Finding, unclear_finding
from app.inference.judge import OK, UNAVAILABLE, NullJudge, Verdict
from app.queue import Worker
from app.verify import verify_finding
from tests.fake_analyzer import FakeAnalyzer
from tests.fake_judge import FakeJudge


def finding(**kw):
    base = dict(defect_type="roof", severity=3, urgency="1_year", confidence="high",
                image_quality="ok", reason="Curling shingles along the roof edge.",
                title="Curling shingles")
    base.update(kw)
    return Finding(**base)


def judged(verdict, **kw):
    return verify_finding(FakeJudge(verdict=verdict), finding(**kw))


def test_agreeing_judge_changes_nothing_but_records_probabilities():
    f = judged(Verdict(OK, 0.9, 0.8, 0.02))
    assert (f.category_fits, f.confidence, f.reason) == (True, "high", "Curling shingles along the roof edge.")
    assert (f.judge_status, f.judge_label_p, f.judge_severity_p, f.judge_guard_p) == ("ok", 0.9, 0.8, 0.02)


def test_label_mismatch_sets_category_does_not_fit():
    f = judged(Verdict(OK, 0.1, 0.8, 0.0))
    assert f.category_fits is False and f.confidence == "high" and f.defect_type == "roof"


def test_implausible_severity_demotes_one_step_only():
    assert judged(Verdict(OK, 0.9, 0.1, 0.0)).confidence == "medium"
    f = judged(Verdict(OK, 0.9, 0.1, 0.0), confidence="medium")
    assert f.confidence == "low" and f.defect_type == "unclear"  # low means no grade, same as parsing


def test_confidence_is_never_raised():
    assert judged(Verdict(OK, 0.99, 0.99, 0.0), confidence="medium").confidence == "medium"


def test_cost_or_legal_replaces_reason_and_clears_title():
    f = judged(Verdict(OK, 0.9, 0.9, 0.95))
    assert f.reason == "missing or curling shingles, damaged flashing, sagging roof lines"
    assert f.title == ""


def test_dollar_amount_caught_by_regex_even_when_judge_is_down():
    f = verify_finding(FakeJudge(down=True), finding(reason="Needs about $5000 of repairs."))
    assert f.title == "" and "$" not in f.reason and f.judge_status == "unavailable"


def test_between_thresholds_leaves_answer_alone():
    f = judged(Verdict(OK, 0.5, 0.5, 0.5))
    assert (f.category_fits, f.confidence, f.title) == (True, "high", "Curling shingles")


def test_thresholds_are_tunable():
    f = verify_finding(FakeJudge(verdict=Verdict(OK, 0.4, 0.9, 0.0)), finding(), no=0.5)
    assert f.category_fits is False


def test_unavailable_judge_leaves_finding_unchanged():
    before = vars(finding())
    f = verify_finding(FakeJudge(down=True), finding())
    after = vars(f)
    assert f.judge_status == "unavailable"
    assert {k: v for k, v in after.items() if not k.startswith("judge")} == \
           {k: v for k, v in before.items() if not k.startswith("judge")}


def test_null_judge_is_skipped():
    assert verify_finding(NullJudge(), finding()).judge_status == "skipped"


def test_not_called_for_ungradable_findings():
    judge = FakeJudge()
    for f in (finding(image_quality="blurry"), finding(image_quality="not_a_house"),
              finding(defect_type="unclear"), unclear_finding("x", "timeout"),
              unclear_finding("x", "unavailable")):
        assert verify_finding(judge, f).judge_status == "skipped"
    assert judge.calls == []


def test_request_state_has_taxonomy_text():
    judge = FakeJudge()
    verify_finding(judge, finding())
    state = judge.calls[0][1]
    assert state["defect_type_label"] == "Roof damage"
    assert state["defect_type_look_for"].startswith("missing or curling shingles")
    assert state["severity"] == 3 and state["title"] == "Curling shingles"


def run_worker(tmp_path, judge, verify=True, finding_=None):
    db = Database(tmp_path / "w.sqlite3")
    sid = db.create_session()
    pid = db.add_photo(sid)
    db.mark_pending(sid)
    w = Worker(db, FakeAnalyzer([finding_ or finding()]), lambda p: b"x", judge=judge, verify=verify)
    assert w.run_once()
    return db.get_finding(pid)


def test_worker_stores_judge_columns(tmp_path):
    row = run_worker(tmp_path, FakeJudge(verdict=Verdict(OK, 0.1, 0.9, 0.0)))
    assert row["category_fits"] == 0
    assert (row["judge_status"], row["judge_label_p"], row["judge_guard_p"]) == ("ok", 0.1, 0.0)


def test_worker_with_verify_off_never_calls_judge(tmp_path):
    judge = FakeJudge()
    row = run_worker(tmp_path, judge, verify=False)
    assert judge.calls == [] and row["judge_status"] == "skipped"


def test_worker_survives_a_judge_that_raises(tmp_path):
    class Boom(FakeJudge):
        def verify(self, state):
            raise RuntimeError("boom")
    row = run_worker(tmp_path, Boom())
    assert row["defect_type"] == "roof" and row["judge_status"] == "unavailable"


def test_old_database_gets_judge_columns(tmp_path):
    path = tmp_path / "old.sqlite3"
    with sqlite3.connect(path) as c:
        c.executescript(
            "CREATE TABLE sessions (id TEXT PRIMARY KEY, zip TEXT, created_at REAL NOT NULL);"
            "CREATE TABLE photos (id TEXT PRIMARY KEY, session_id TEXT, status TEXT DEFAULT 'uploaded',"
            " created_at REAL NOT NULL);"
            "CREATE TABLE findings (photo_id TEXT PRIMARY KEY, defect_type TEXT NOT NULL,"
            " severity INTEGER NOT NULL, urgency TEXT NOT NULL, confidence TEXT NOT NULL,"
            " image_quality TEXT NOT NULL, reason TEXT NOT NULL, analysis_status TEXT NOT NULL DEFAULT 'ok',"
            " confirmed INTEGER NOT NULL DEFAULT 0, edited INTEGER NOT NULL DEFAULT 0);"
            "INSERT INTO findings VALUES('p','roof',3,'1_year','high','ok','r','ok',0,0);")
    Database(path)
    with sqlite3.connect(path) as c:
        c.row_factory = sqlite3.Row
        row = c.execute("SELECT * FROM findings").fetchone()
    assert row["judge_status"] == "skipped" and row["judge_label_p"] is None and row["judge_top"] == "[]"


# ---- label mismatch: the judge moves the finding to a better category ---------------------

MISFIT = Verdict(OK, 0.05, 0.9, 0.0)


def moved(top, **kw):
    from app.inference.judge import TypeChoice
    judge = FakeJudge(verdict=MISFIT, choice=TypeChoice(OK, top))
    return verify_finding(judge, finding(**kw)), judge


def test_mismatch_moves_to_the_judges_category_and_it_displays_as_that_category():
    f, judge = moved([("plumbing", 0.9), ("roof", 0.05)])
    assert (f.defect_type, f.category_fits, f.confidence) == ("plumbing", True, "high")
    assert f.judge_top[0] == ["plumbing", 0.9]
    assert [c[0] for c in judge.calls] == ["verify", "classify"]
    from app import present
    row = dict(vars(f), edited=0)
    assert present.display_label(row, {"label": "Plumbing problem"}) == "Plumbing problem"


def test_move_lowers_confidence_when_the_judge_is_less_sure():
    f, _ = moved([("plumbing", 0.6)])
    assert (f.defect_type, f.confidence) == ("plumbing", "medium")


def test_move_never_raises_confidence():
    f, _ = moved([("plumbing", 0.95)], confidence="medium")
    assert (f.defect_type, f.confidence) == ("plumbing", "medium")


def test_unsure_judge_keeps_the_type_and_shows_the_title():
    f, _ = moved([("plumbing", 0.3), ("roof", 0.2)])
    assert (f.defect_type, f.category_fits) == ("roof", False)


def test_none_of_these_keeps_the_type_and_shows_the_title():
    from app.inference.judge import NONE_OF_THESE
    f, _ = moved([(NONE_OF_THESE, 0.95)])
    assert (f.defect_type, f.category_fits) == ("roof", False)


def test_judge_agreeing_with_gemmas_type_still_shows_the_title():
    f, _ = moved([("roof", 0.95)])  # the two judge questions disagree: do not trust either
    assert (f.defect_type, f.category_fits) == ("roof", False)


def test_classify_failure_falls_back_to_the_title():
    class HalfDown(FakeJudge):
        def classify(self, reason, title):
            from app.inference.judge import TypeChoice
            return TypeChoice(UNAVAILABLE)
    f = verify_finding(HalfDown(verdict=MISFIT), finding())
    assert (f.defect_type, f.category_fits) == ("roof", False)


def test_good_label_never_asks_for_a_new_category():
    judge = FakeJudge(verdict=Verdict(OK, 0.9, 0.9, 0.0))
    verify_finding(judge, finding())
    assert [c[0] for c in judge.calls] == ["verify"]
