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


def test_title_and_fit_flag_are_read():
    f = parse_model_output(good(title="Fallen tree on roof", category_fits=False))
    assert (f.title, f.category_fits) == ("Fallen tree on roof", False)


def test_missing_title_and_flag_default_to_category():
    f = parse_model_output(good())
    assert (f.title, f.category_fits) == ("", True)


@pytest.mark.parametrize("raw, expected", [
    (False, False), ("false", False), ("No", False), (True, True), ("true", True), (None, True), (7, True),
])
def test_fit_flag_parsing(raw, expected):
    assert parse_model_output(good(category_fits=raw)).category_fits is expected


@pytest.mark.parametrize("raw, expected", [
    ("  Fallen tree on roof. ", "Fallen tree on roof"),
    ("water_intrusion", "Water intrusion"),
    (None, ""), (5, ""), ("", ""),
    ("one two three four five six seven eight", "One two three four five six"),
])
def test_title_is_cleaned(raw, expected):
    assert parse_model_output(good(title=raw)).title == expected


def test_prompt_schema_ask_for_title_and_fit_flag_with_reason_first():
    props = list(output_schema()["properties"])
    assert props[:2] == ["reason", "title"]
    assert "category_fits" in output_schema()["required"] and "title" in output_schema()["required"]
    assert "category_fits" in build_prompt()
