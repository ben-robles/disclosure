"""Second opinion on a finding. The judge returns probabilities; this module maps them to states.

Rules (thresholds in config, between them Gemma's answer stands):
  label_matches < NO       -> the label contradicts Gemma's own sentence. Fix it, in order:
                              1. second look: Gemma sees the photo again, told which label did
                                 not match; its new answer is kept only if the judge now agrees
                              2. the judge picks a better category from the text, if sure (>= MEDIUM)
                              3. otherwise category_fits = False (the UI shows the model's title)
                              Confidence is never raised by a fix; a second look caps it at medium.
  severity_plausible < NO  -> confidence drops one step; never raised
  has_cost_or_legal > YES  -> reason becomes the taxonomy "look for" text, title is cleared
A dollar amount in the text is also caught by a regex, whether or not the judge answered.
"""
import re

from . import config
from .inference.analyzer import Finding
from .inference.judge import NONE_OF_THESE, OK, SKIPPED, Judge, Verdict
from .inference.prompts import load_taxonomy

MONEY = re.compile(r"\$\s*\d")
DEMOTE = {"high": "medium", "medium": "low", "low": "low"}
RANK = {"low": 0, "medium": 1, "high": 2}


def eligible(f: Finding) -> bool:
    """Only a real, gradable claim is worth a second opinion."""
    return f.analysis_status == "ok" and f.image_quality == "ok" and f.defect_type != "unclear"


def _ask(judge: Judge, f: Finding, taxonomy: dict):
    """One verification of a finding; None when there is no judge or no such category."""
    entry = taxonomy.get(f.defect_type)
    if entry is None or not judge.enabled:
        return None
    return judge.verify({
        "reason": f.reason,
        "title": f.title,
        "defect_type_id": entry["id"],
        "defect_type_label": entry["label"],
        "defect_type_look_for": entry["look_for"],
        "severity": f.severity,
        "urgency": f.urgency,
    })


def _record(f: Finding, v: Verdict) -> None:
    f.judge_status = v.status
    if v.status == OK:
        f.judge_label_p, f.judge_severity_p = v.label_matches, v.severity_plausible
        f.judge_guard_p = v.has_cost_or_legal


def _hint(f: Finding, taxonomy: dict) -> str:
    label = taxonomy[f.defect_type]["label"]
    return (
        f'A reviewer found that your first answer contradicted itself: you chose the category '
        f'"{label}" but described "{f.reason}". Look at the photo again. Describe the most '
        "significant problem visible, even if it is not the main object in the photo, and pick "
        "the category that matches what you describe."
    )


def _second_look(judge, f, taxonomy, reanalyze, no):
    """Gemma looks again. Return (new finding, its verdict) only if the judge now agrees."""
    try:
        g = reanalyze(_hint(f, taxonomy))
    except Exception:  # a failed second look just means we keep the first answer
        return None
    if g is None or not eligible(g):
        return None
    v = _ask(judge, g, taxonomy)
    if v is None or v.status != OK or v.label_matches < no:
        return None
    _record(g, v)
    g.category_fits = True
    if RANK[g.confidence] > RANK["medium"]:
        g.confidence = "medium"  # it needed correcting, so never show it as high certainty
    return g, v


def _recategorize(judge: Judge, f: Finding, taxonomy: dict) -> None:
    """Let the judge pick the category from Gemma's text, if it is sure and disagrees."""
    choice = judge.classify(f.reason, f.title)
    if choice.status != OK:
        f.category_fits = False
        return
    f.judge_top = [[i, round(p, 4)] for i, p in choice.top]
    best, p = choice.best
    if (best == NONE_OF_THESE or best == f.defect_type or best not in taxonomy
            or p < config.JUDGE_CONF_MEDIUM):
        f.category_fits = False
        return
    f.defect_type = best
    f.category_fits = True
    derived = "high" if p >= config.JUDGE_CONF_HIGH else "medium"
    if RANK[derived] < RANK[f.confidence]:
        f.confidence = derived


def verify_finding(judge: Judge, f: Finding, yes=None, no=None, reanalyze=None) -> Finding:
    """Return the finding with judge fields filled and any fix applied. Never raises.

    reanalyze: optional callable(hint) -> Finding, a second look at the same photo."""
    yes = config.JUDGE_YES if yes is None else yes
    no = config.JUDGE_NO if no is None else no
    if not eligible(f):
        return f
    taxonomy = {d["id"]: d for d in load_taxonomy()}
    v = _ask(judge, f, taxonomy)
    if v is None and f.defect_type not in taxonomy:
        return f
    f.judge_status = SKIPPED if v is None else v.status
    guard = False
    if v is not None and v.status == OK:
        _record(f, v)
        if v.label_matches < no:
            second = _second_look(judge, f, taxonomy, reanalyze, no) if reanalyze else None
            if second:
                f, v = second
            else:
                _recategorize(judge, f, taxonomy)
        if v.severity_plausible < no:
            f.confidence = DEMOTE[f.confidence]
            if f.confidence == "low":
                f.defect_type = "unclear"  # same rule as parse_model_output
        guard = v.has_cost_or_legal > yes
    if guard or MONEY.search(f.reason) or MONEY.search(f.title):
        f.reason = taxonomy[f.defect_type]["look_for"]
        f.title = ""
    return f
