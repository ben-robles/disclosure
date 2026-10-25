"""Prompt and output schema, both built from assets/defect_taxonomy.json.

PROMPT_VERSION v3.2 - bump on every wording change; test-results.md logs it.
"""
import json

from ..config import ASSETS_DIR
from .analyzer import CONFIDENCES, QUALITIES, URGENCIES

PROMPT_VERSION = "v3.2"
# v4 is used only with DISCLOSURE_JUDGE_CLASSIFY: Gemma describes, the text judge picks the type.
PROMPT_VERSION_V4 = "v4"


def prompt_version(classify: bool = False) -> str:
    return PROMPT_VERSION_V4 if classify else PROMPT_VERSION


def load_taxonomy() -> list:
    data = json.loads((ASSETS_DIR / "defect_taxonomy.json").read_text(encoding="utf-8"))
    return data["defects"]


def taxonomy_ids() -> list:
    return [d["id"] for d in load_taxonomy()]


def build_prompt(classify: bool = False) -> str:
    if classify:
        return _build_prompt_v4()
    allowed = "\n".join(f"- {d['id']}: {d['look_for']}" for d in load_taxonomy())
    return (
        "You are helping a home seller document one possible defect from one photo.\n"
        "Look only at what is visible. Reply with JSON only, no other text.\n\n"
        "defect_type must be exactly one of these ids:\n"
        f"{allowed}\n\n"
        "Pick the most specific id that fits the damage visible now, not damage it might "
        "cause later. A tree on a roof is roof damage, not water_intrusion.\n"
        "If no id describes what is visible, pick the closest one and set category_fits to false.\n\n"
        "Fields:\n"
        "- reason: one sentence, at most 20 words, describing what is visible. "
        "No costs, no legal language. Write this first.\n"
        "- title: 2 to 5 words naming what is visible, such as Fallen tree on roof. "
        "Name the visible problem, not a risk it may cause.\n"
        "- category_fits: true only if defect_type names the same problem as title and reason.\n"
        "- severity: integer 1 (trivial) to 5 (dangerous or structural)\n"
        f"- urgency: one of {', '.join(URGENCIES)}\n"
        f"- confidence: one of {', '.join(CONFIDENCES)}. Use low if you are unsure.\n"
        f"- image_quality: one of {', '.join(QUALITIES)}. "
        "Use blurry if the photo is too blurry to judge "
        "(a sharp subject with a blurred background is not blurry), "
        "not_a_house if it does not show part of a home.\n\n"
        "If you cannot tell, use defect_type unclear and confidence low."
    )


def _build_prompt_v4() -> str:
    return (
        "You are helping a home seller document one possible defect from one photo.\n"
        "Look only at what is visible. Reply with JSON only, no other text.\n\n"
        "Describe the damage visible now, not damage it might cause later. "
        "A tree on a roof is roof damage, not water damage.\n\n"
        "Fields:\n"
        "- reason: one sentence, at most 20 words. Name the part of the home and what is wrong "
        "with it. No costs, no legal language. Write this first.\n"
        "- title: 2 to 5 words naming what is visible, such as Fallen tree on roof.\n"
        "- severity: integer 1 (trivial) to 5 (dangerous or structural)\n"
        f"- urgency: one of {', '.join(URGENCIES)}\n"
        f"- image_quality: one of {', '.join(QUALITIES)}. "
        "Use blurry if the photo is too blurry to judge, "
        "not_a_house if it does not show part of a home."
    )

def output_schema(classify: bool = False) -> dict:
    if classify:
        schema = output_schema()
        for key in ("defect_type", "category_fits", "confidence"):
            schema["properties"].pop(key)
            schema["required"].remove(key)
        return schema
    return {
        "type": "object",
        "properties": {
            "reason": {"type": "string"},
            "title": {"type": "string"},
            "defect_type": {"type": "string", "enum": taxonomy_ids()},
            "category_fits": {"type": "boolean"},
            "severity": {"type": "integer", "minimum": 1, "maximum": 5},
            "urgency": {"type": "string", "enum": list(URGENCIES)},
            "confidence": {"type": "string", "enum": list(CONFIDENCES)},
            "image_quality": {"type": "string", "enum": list(QUALITIES)},
        },
        "required": ["reason", "title", "defect_type", "category_fits", "severity", "urgency",
                     "confidence", "image_quality"],
    }
