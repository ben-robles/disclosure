"""The one boundary between the app and any model."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

URGENCIES = ("immediate", "30_days", "1_year", "cosmetic")
CONFIDENCES = ("high", "medium", "low")
QUALITIES = ("ok", "blurry", "not_a_house")


@dataclass
class Finding:
    defect_type: str
    severity: int
    urgency: str
    confidence: str
    image_quality: str
    reason: str
    analysis_status: str = "ok"  # ok | timeout | unavailable | invalid
    # Model-written name for what is visible. Shown instead of the category label when
    # category_fits is False (the closest category is only used for grading and cost).
    title: str = ""
    category_fits: bool = True
    # Text-only judge (app/inference/judge.py). Probabilities are stored raw; code applies thresholds.
    judge_status: str = "skipped"  # ok | skipped | unavailable
    judge_label_p: float = None
    judge_severity_p: float = None
    judge_guard_p: float = None
    judge_top: list = field(default_factory=list)  # [(defect id, probability)], best first


def unclear_finding(reason: str, analysis_status: str) -> Finding:
    return Finding("unclear", 1, "cosmetic", "low", "ok", reason, analysis_status)


class DefectAnalyzer(ABC):
    @abstractmethod
    def analyze(self, image_bytes: bytes) -> Finding:
        """Never raises for model problems; returns an `unclear` Finding instead."""

    @abstractmethod
    def status(self) -> dict:
        """{'ready': bool, 'message': str, 'fix': str}. Used by the startup banner."""
