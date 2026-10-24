import json

import pytest

from app.inference.ollama_analyzer import ParseError, parse_model_output
from app.inference.prompts import build_prompt, load_taxonomy, output_schema


def good(**kw):
    d = dict(defect_type="roof", severity=3, urgency="30_days", confidence="high",
             image_quality="ok", reason="Curling shingles near the roof edge.")
    d.update(kw)
    return json.dumps(d)


def test_parses_clean_json():
    f = parse_model_output(good())
    assert (f.defect_type, f.severity, f.confidence) == ("roof", 3, "high")


def test_strips_code_fences_and_chatter():
    f = parse_model_output("Sure!\n```json\n" + good() + "\n```\nHope that helps")
    assert f.defect_type == "roof"


def test_numeric_string_severity_is_accepted():
    assert parse_model_output(good(severity="4")).severity == 4


@pytest.mark.parametrize("bad", [
    "", "no json here", "{not json}", "[1,2]",
    good(defect_type="asbestos"),
    good(severity=9), good(severity=0), good(severity=True), good(severity="high"),
    good(urgency="soon"), good(confidence="certain"), good(image_quality="dark"),
    good(reason=""), good(reason=None),
])
def test_rejects_invalid(bad):
    with pytest.raises(ParseError):
        parse_model_output(bad)


def test_low_confidence_forces_unclear():
    assert parse_model_output(good(confidence="low")).defect_type == "unclear"


def test_reason_truncated_to_20_words():
    long = " ".join(["word"] * 40)
    assert len(parse_model_output(good(reason=long)).reason.split()) == 20


def test_prompt_and_schema_come_from_taxonomy():
    ids = [d["id"] for d in load_taxonomy()]
    prompt = build_prompt()
    assert all(i in prompt for i in ids)
    assert output_schema()["properties"]["defect_type"]["enum"] == ids
