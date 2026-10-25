"""Second opinion on a finding. The judge returns probabilities; this module maps them to states.

Rules (thresholds in config, between them Gemma's answer stands):
  label_matches < NO       -> category_fits = False (the UI shows the model's title)
  severity_plausible < NO  -> confidence drops one step; never raised
  has_cost_or_legal > YES  -> reason becomes the taxonomy "look for" text, title is cleared
A dollar amount in the text is also caught by a regex, whether or not the judge answered.
"""
import re

from . import config
from .inference.analyzer import Finding
from .inference.judge import OK, SKIPPED, Judge
from .inference.prompts import load_taxonomy

MONEY = re.compile(r"\$\s*\d")
DEMOTE = {"high": "medium", "medium": "low", "low": "low"}


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
            f.category_fits = False
        if v.severity_plausible < no:
            f.confidence = DEMOTE[f.confidence]
            if f.confidence == "low":
                f.defect_type = "unclear"  # same rule as parse_model_output
        guard = v.has_cost_or_legal > yes
    if guard or MONEY.search(f.reason) or MONEY.search(f.title):
        f.reason = taxonomy[f.defect_type]["look_for"]
        f.title = ""
    return f
