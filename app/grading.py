"""Pure grading functions. No I/O."""
from dataclasses import dataclass

URGENCY_SCORE = {"immediate": 4, "30_days": 3, "1_year": 2, "cosmetic": 1}
URGENCY_LABEL = {
    "immediate": "Fix immediately",
    "30_days": "Within 30 days",
    "1_year": "Within a year",
    "cosmetic": "Cosmetic",
}
LETTERS = ["A", "B", "C", "D", "F"]
LETTER_WORD = {"A": "Minor", "B": "Moderate", "C": "Serious", "D": "Urgent", "F": "Critical"}

CANT_TELL = "Can't tell — get an inspector"


def risk_score(severity: int, urgency: str) -> int:
    return severity * URGENCY_SCORE[urgency]


def letter_for_risk(risk: int) -> str:
    if risk <= 3:
        return "A"
    if risk <= 6:
        return "B"
    if risk <= 10:
        return "C"
    if risk <= 15:
        return "D"
    return "F"


def worse_letter(letter: str) -> str:
    i = LETTERS.index(letter)
    return LETTERS[min(i + 1, len(LETTERS) - 1)]


@dataclass(frozen=True)
class GradeRange:
    best: str
    worst: str

    @property
    def text(self) -> str:
        return self.best if self.best == self.worst else f"{self.best}–{self.worst}"

    @property
    def word(self) -> str:
        if self.best == self.worst:
            return LETTER_WORD[self.best]
        return f"{LETTER_WORD[self.best]} to {LETTER_WORD[self.worst]}"

    @property
    def aria(self) -> str:
        if self.best == self.worst:
            return f"Grade {self.best}, {LETTER_WORD[self.best]}"
        return f"Grade {self.best} to {self.worst}, {self.word}"


def grade_range(severity: int, urgency: str, confidence: str):
    """high -> one letter; medium -> letter and next worse; low -> None (no grade)."""
    if confidence == "low":
        return None
    letter = letter_for_risk(risk_score(severity, urgency))
    if confidence == "high":
        return GradeRange(letter, letter)
    return GradeRange(letter, worse_letter(letter))


def overall_grade(ranges):
    """Worst worst-end letter among the given GradeRange objects. Never an average."""
    worst = None
    for r in ranges:
        if r is None:
            continue
        if worst is None or LETTERS.index(r.worst) > LETTERS.index(worst):
            worst = r.worst
    return worst


def needs_evaluation(grade_range_: "GradeRange | None") -> bool:
    """Guardrail 4: any finding graded D or F gets an evaluation recommendation."""
    return grade_range_ is not None and LETTERS.index(grade_range_.worst) >= LETTERS.index("D")


def assess(finding: dict) -> dict:
    """Turn a stored finding row into a display state.

    state: graded | blurry | not_a_house | cant_tell | timeout | unavailable
    A finding the user edited is user-asserted, so it is graded as high confidence.
    """
    status = finding.get("analysis_status", "ok")
    if status == "timeout":
        return {"state": "timeout", "grade": None}
    if status == "unavailable":
        return {"state": "unavailable", "grade": None}
    quality = finding.get("image_quality", "ok")
    if quality == "blurry":
        return {"state": "blurry", "grade": None}
    if quality == "not_a_house":
        return {"state": "not_a_house", "grade": None}
    edited = bool(finding.get("edited"))
    confidence = "high" if edited else finding["confidence"]
    if finding["defect_type"] == "unclear" or confidence == "low":
        return {"state": "cant_tell", "grade": None}
    gr = grade_range(finding["severity"], finding["urgency"], confidence)
    return {"state": "graded", "grade": gr}
