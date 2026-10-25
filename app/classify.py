"""Calibrated confidence: the text judge picks the defect type, and its distribution sets confidence.

Gemma (prompt v4) only describes what it sees; it no longer names a type or rates itself.
Top probability >= HIGH -> high, >= MEDIUM -> medium, otherwise or `none_of_these` -> low
(an `unclear` finding: no grade, inspector message). Thresholds are in config.
"""
from . import config
from .inference.analyzer import Finding, unclear_finding
from .inference.judge import NONE_OF_THESE, OK, Judge


def active(judge: Judge) -> bool:
    """On only when asked for AND a real judge exists; otherwise Gemma keeps naming the type (v3)."""
    return config.JUDGE_CLASSIFY and judge.enabled


def classify_finding(judge: Judge, f: Finding, high=None, medium=None) -> Finding:
    high = config.JUDGE_CONF_HIGH if high is None else high
    medium = config.JUDGE_CONF_MEDIUM if medium is None else medium
    if f.analysis_status != "ok" or f.image_quality != "ok":
        return f  # blurry, not a house, timeout: nothing to classify
    choice = judge.classify(f.reason, f.title)
    if choice.status != OK:
        out = unclear_finding("The AI model is not reachable.", "unavailable")
        out.judge_status = "unavailable"
        return out  # never grade without a type; the UI shows Retry
    best, p = choice.best
    f.judge_status = "ok"
    f.judge_top = [[i, round(prob, 4)] for i, prob in choice.top]
    if best == NONE_OF_THESE or p < medium:
        f.defect_type, f.confidence = "unclear", "low"
    else:
        f.defect_type = best
        f.confidence = "high" if p >= high else "medium"
    f.category_fits = True
    return f
