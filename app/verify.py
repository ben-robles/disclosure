"""Second opinion on a finding. The judge returns probabilities; this module maps them to states.

Rules (thresholds in config, between them Gemma's answer stands):
  label_matches < NO       -> the judge picks a better category from Gemma's text; if it is
                              sure (>= MEDIUM) and differs, the finding moves to it and the UI
                              shows that category. Otherwise category_fits = False (the UI shows
                              the model's title). Confidence is never raised by the move.
  severity_plausible < NO  -> confidence drops one step; never raised
  has_cost_or_legal > YES  -> reason becomes the taxonomy "look for" text, title is cleared
A dollar amount in the text is also caught by a regex, whether or not the judge answered.
"""
import re

from . import config
from .inference.analyzer import Finding
from .inference.judge import NONE_OF_THESE, OK, SKIPPED, Judge
from .inference.prompts import load_taxonomy

MONEY = re.compile(r"\$\s*\d")
DEMOTE = {"high": "medium", "medium": "low", "low": "low"}
RANK = {"low": 0, "medium": 1, "high": 2}


def _recategorize(judge: Judge, f: Finding, taxonomy: dict) -> None:
    """The label did not match Gemma's text: let the judge pick the category instead."""
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


def eligible(f: Finding) -> bool:
    """Only a real, gradable claim is worth a second opinion."""
    return f.analysis_status == "ok" and f.image_quality == "ok" and f.defect_type != "unclear"


def verify_finding(judge: Judge, f: Finding, yes=None, no=None) -> Finding:
    """Return the finding with judge fields filled and any demotion applied. Never raises."""
    yes = config.JUDGE_YES if yes is None else yes
    no = config.JUDGE_NO if no is None else no
    if not eligible(f):
        return f
    taxonomy = {d["id"]: d for d in load_taxonomy()}
    entry = taxonomy.get(f.defect_type)
    if entry is None:
        return f
    v = judge.verify({
        "reason": f.reason,
        "title": f.title,
        "defect_type_id": entry["id"],
        "defect_type_label": entry["label"],
        "defect_type_look_for": entry["look_for"],
        "severity": f.severity,
        "urgency": f.urgency,
    }) if judge.enabled else None
    f.judge_status = SKIPPED if v is None else v.status
    guard = False
    if v is not None and v.status == OK:
        f.judge_label_p, f.judge_severity_p = v.label_matches, v.severity_plausible
        f.judge_guard_p = v.has_cost_or_legal
        if v.label_matches < no:
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
