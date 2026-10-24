import json

from .config import ASSETS_DIR

_TABLE = None


def _table() -> dict:
    global _TABLE
    if _TABLE is None:
        _TABLE = json.loads((ASSETS_DIR / "cost_table.json").read_text(encoding="utf-8"))
    return _TABLE


def bucket_for(severity: int) -> str:
    if severity <= 2:
        return "1-2"
    if severity == 3:
        return "3"
    return "4-5"


def lookup(defect_type: str, severity: int):
    """Return {'low': int, 'high': int} or None (e.g. for 'unclear')."""
    row = _table()["ranges"].get(defect_type)
    if not row:
        return None
    return row[bucket_for(severity)]


def region() -> str:
    return _table()["region"]


def format_range(rng) -> str:
    if not rng:
        return ""
    return f"${rng['low']:,}–${rng['high']:,}"
