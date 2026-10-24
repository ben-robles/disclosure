"""Loads assets/defect_taxonomy.json — the single source of truth for defect ids."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

TAXONOMY_PATH = Path(__file__).resolve().parent.parent / "assets" / "defect_taxonomy.json"


@lru_cache(maxsize=1)
def load_taxonomy() -> dict:
    """Return {id: {id, label, description, pro}} in file order."""
    with TAXONOMY_PATH.open(encoding="utf-8") as f:
        return {d["id"]: d for d in json.load(f)["defects"]}


def defect_ids() -> list:
    return list(load_taxonomy())
