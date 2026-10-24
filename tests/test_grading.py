import pytest

from app import grading
from app.grading import GradeRange, assess, grade_range, letter_for_risk, overall_grade


@pytest.mark.parametrize("risk,letter", [
    (1, "A"), (3, "A"), (4, "B"), (6, "B"), (7, "C"), (10, "C"),
    (11, "D"), (15, "D"), (16, "F"), (20, "F"),
])
def test_risk_boundaries(risk, letter):
    assert letter_for_risk(risk) == letter


def test_risk_is_severity_times_urgency():
    assert grading.risk_score(5, "immediate") == 20
    assert grading.risk_score(1, "cosmetic") == 1
    assert grading.risk_score(3, "1_year") == 6
    assert grading.risk_score(4, "30_days") == 12


def test_high_confidence_is_single_letter():
    r = grade_range(3, "1_year", "high")  # risk 6 -> B
    assert (r.best, r.worst, r.text) == ("B", "B", "B")


def test_medium_confidence_adds_next_worse_letter():
    r = grade_range(3, "30_days", "medium")  # risk 9 -> C, range C-D
    assert (r.best, r.worst, r.text) == ("C", "D", "C–D")
    assert r.aria == "Grade C to D, Serious to Urgent"


def test_medium_at_worst_letter_stays_f():
    r = grade_range(5, "immediate", "medium")
    assert (r.best, r.worst) == ("F", "F")
    assert r.text == "F"


def test_low_confidence_has_no_grade():
    assert grade_range(5, "immediate", "low") is None


def test_overall_is_worst_never_average():
    ranges = [GradeRange("A", "A"), GradeRange("C", "D"), GradeRange("B", "B")]
    assert overall_grade(ranges) == "D"
    assert overall_grade([GradeRange("A", "A"), GradeRange("A", "A")]) == "A"


def test_overall_ignores_ungraded_and_empty():
    assert overall_grade([None, GradeRange("B", "B")]) == "B"
    assert overall_grade([None]) is None
    assert overall_grade([]) is None


def test_needs_evaluation_only_d_or_f():
    assert not grading.needs_evaluation(GradeRange("C", "C"))
    assert grading.needs_evaluation(GradeRange("C", "D"))
    assert grading.needs_evaluation(GradeRange("F", "F"))
    assert not grading.needs_evaluation(None)


def base(**kw):
    row = dict(defect_type="roof", severity=3, urgency="30_days", confidence="high",
               image_quality="ok", analysis_status="ok", edited=0)
    row.update(kw)
    return row


def test_assess_states():
    assert assess(base())["state"] == "graded"
    assert assess(base(image_quality="blurry"))["state"] == "blurry"
    assert assess(base(image_quality="not_a_house"))["state"] == "not_a_house"
    assert assess(base(confidence="low"))["state"] == "cant_tell"
    assert assess(base(defect_type="unclear"))["state"] == "cant_tell"
    assert assess(base(analysis_status="timeout"))["state"] == "timeout"
    assert assess(base(analysis_status="unavailable"))["state"] == "unavailable"


def test_blurry_beats_confidence_and_has_no_grade():
    assert assess(base(image_quality="blurry", confidence="high"))["grade"] is None


def test_edited_low_confidence_finding_is_graded_as_user_asserted():
    a = assess(base(confidence="low", edited=1))
    assert a["state"] == "graded"
    assert a["grade"].best == a["grade"].worst
