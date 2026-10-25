"""Turn stored rows into display dicts shared by the API and the PDF."""
from . import costs, grading
from .inference.prompts import load_taxonomy
from .report import mapping

INSPECTOR = "Licensed home inspector"

MESSAGES = {
    "blurry": "Photo too blurry — retake closer and in better light.",
    "not_a_house": "This doesn't look like part of a home. Try again.",
    "cant_tell": "Can't tell from this photo — recommend a licensed home inspector.",
    "timeout": "Analysis timed out.",
    "unavailable": "The AI model could not be reached.",
}


def _taxonomy() -> dict:
    return {d["id"]: d for d in load_taxonomy()}


OTHER_ISSUE = "Other issue"


def display_label(row: dict, entry: dict) -> str:
    """Category label, unless the model said the category does not fit what it saw.

    Then the model's own title is shown (the category list itself never changes).
    An inspector's edit picks a category by hand, so the category label wins again.
    """
    if row.get("edited") or row.get("category_fits", 1):
        return entry["label"]
    return (row.get("title") or "").strip() or OTHER_ISSUE


def enrich(row: dict) -> dict:
    """row = one item from Database.session_photos()."""
    out = {"id": row["id"], "status": row["status"], "analyzed": row["defect_type"] is not None}
    if not out["analyzed"]:
        return out
    tax = _taxonomy()
    a = grading.assess(row)
    state, gr = a["state"], a["grade"]
    entry = tax.get(row["defect_type"], tax["unclear"])
    pro = entry["pro"] if state == "graded" else (INSPECTOR if state == "cant_tell" else None)
    cost = costs.lookup(row["defect_type"], row["severity"]) if state == "graded" else None
    evaluate = grading.needs_evaluation(gr)
    sec_key, sec_heading = mapping.section_for(row["defect_type"])
    out.update({
        "state": state,
        "section_key": sec_key,
        "section": sec_heading,
        "defect_type": row["defect_type"],
        "label": display_label(row, entry) if state == "graded" else "Cannot determine",
        "severity": row["severity"],
        "urgency": row["urgency"],
        "urgency_label": grading.URGENCY_LABEL[row["urgency"]],
        "confidence": row["confidence"],
        "reason": row["reason"],
        "edited": bool(row["edited"]),
        "confirmed": bool(row["confirmed"]),
        "message": MESSAGES.get(state),
        "grade": None if gr is None else {
            "text": gr.text, "word": gr.word, "aria": gr.aria, "worst": gr.worst,
        },
        "cost": None if cost is None else {
            "low": cost["low"], "high": cost["high"], "text": costs.format_range(cost),
        },
        "pro": pro,
        # only graded or can't-tell findings may be confirmed into the report
        "can_confirm": state in ("graded", "cant_tell"),
        "can_edit": state in ("graded", "cant_tell"),
        "needs_retake": state in ("blurry", "not_a_house"),
        "needs_retry": state in ("timeout", "unavailable"),
        "evaluation": f"Recommend evaluation by a licensed {pro.lower()}." if evaluate else None,
    })
    return out


def overall(enriched: list):
    """Overall letter from confirmed, graded findings only (worst wins)."""
    letters = [f["grade"]["worst"] for f in enriched
               if f.get("confirmed") and f.get("grade")]
    if not letters:
        return None
    return max(letters, key=grading.LETTERS.index)
