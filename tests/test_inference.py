import io
import json

import pytest
from PIL import Image

from app.images import prepare_image
from app.inference.analyzer import parse_finding
from app.inference.ollama_analyzer import response_schema
from app.inference.prompts import build_prompt
from app.taxonomy import defect_ids

GOOD = {"defect_type": "roof", "severity": 4, "urgency": "30_days", "confidence": "high",
        "image_quality": "ok", "reason": "Missing shingles near the ridge."}


def test_parse_ok_and_fenced():
    assert parse_finding(json.dumps(GOOD)).defect_type == "roof"
    assert parse_finding("```json\n" + json.dumps(GOOD) + "\n```").severity == 4


@pytest.mark.parametrize("patch", [{"defect_type": "ghosts"}, {"severity": 9}, {"urgency": "now"}, {"reason": ""}])
def test_parse_rejects_off_schema(patch):
    with pytest.raises(ValueError):
        parse_finding(json.dumps({**GOOD, **patch}))


def test_low_confidence_forced_unclear():
    assert parse_finding(json.dumps({**GOOD, "confidence": "low"})).defect_type == "unclear"


def test_prompt_and_schema_come_from_taxonomy():
    assert response_schema()["properties"]["defect_type"]["enum"] == defect_ids()
    assert all(i in build_prompt() for i in defect_ids())


def test_prepare_image_strips_exif_and_resizes():
    im = Image.new("RGB", (3000, 2000), "red")
    exif = Image.Exif()
    exif[0x010F] = "SecretPhone"
    buf = io.BytesIO()
    im.save(buf, format="JPEG", exif=exif)
    out = Image.open(io.BytesIO(prepare_image(buf.getvalue())))
    assert max(out.size) == 1024
    assert not out.getexif()
