import json

import pytest

from app import costs
from app.config import ASSETS_DIR
from app.inference.prompts import taxonomy_ids


@pytest.mark.parametrize("sev,bucket", [(1, "1-2"), (2, "1-2"), (3, "3"), (4, "4-5"), (5, "4-5")])
def test_buckets(sev, bucket):
    assert costs.bucket_for(sev) == bucket


def test_every_taxonomy_id_has_a_row_and_unclear_has_none():
    table = json.loads((ASSETS_DIR / "cost_table.json").read_text(encoding="utf-8"))
    assert set(table["ranges"]) == set(taxonomy_ids())
    assert table["ranges"]["unclear"] is None
    assert costs.lookup("unclear", 3) is None


def test_ranges_are_ordered_and_grow_with_severity():
    for defect in taxonomy_ids():
        if defect == "unclear":
            continue
        rows = [costs.lookup(defect, s) for s in (1, 3, 5)]
        for r in rows:
            assert 0 < r["low"] < r["avg"] < r["high"]
        assert rows[0]["high"] <= rows[2]["high"]


def test_table_is_labelled_placeholder():
    table = json.loads((ASSETS_DIR / "cost_table.json").read_text(encoding="utf-8"))
    assert table["status"].startswith("PLACEHOLDER")
    assert table["region"] == "DC/MD/VA metro"


def test_format():
    assert costs.format_range({"low": 1000, "high": 4000}) == "$1,000–$4,000"
    assert costs.format_avg({"avg": 2500}) == "$2,500"
