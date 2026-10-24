import json

from ..config import ASSETS_DIR

NEEDS_INSPECTOR = "Needs review by a licensed home inspector"

_DATA = None


def _data() -> dict:
    global _DATA
    if _DATA is None:
        _DATA = json.loads((ASSETS_DIR / "jurisdiction_md.json").read_text(encoding="utf-8"))
    return _DATA


def form_title() -> str:
    return _data()["form_title"]


def section_for(defect_type: str):
    """Return (sort_key, heading) for a taxonomy id; unmapped ids go to the inspector group."""
    entry = _data()["mapping"].get(defect_type)
    if not entry or not entry["section"]:
        return (999, NEEDS_INSPECTOR)
    num = entry["section"]
    return (int(num), f"Form question {num}: {_data()['sections'][num]}")


def group_findings(items: list) -> list:
    """items: dicts with 'defect_type'. Returns [(heading, [items...])] in form order."""
    groups = {}
    for it in items:
        key, heading = section_for(it["defect_type"])
        groups.setdefault((key, heading), []).append(it)
    return [(heading, groups[(key, heading)]) for key, heading in sorted(groups)]
