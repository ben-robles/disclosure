"""Prompt and output schema, both built from assets/defect_taxonomy.json.

PROMPT_VERSION v2 - bump on every wording change; test-results.md logs it.
"""
import json

from ..config import ASSETS_DIR
from .analyzer import CONFIDENCES, QUALITIES, URGENCIES

PROMPT_VERSION = "v2"


def load_taxonomy() -> list:
    data = json.loads((ASSETS_DIR / "defect_taxonomy.json").read_text(encoding="utf-8"))
    return data["defects"]


def taxonomy_ids() -> list:
    return [d["id"] for d in load_taxonomy()]


def build_prompt() -> str:
    allowed = "\n".join(f"- {d['id']}: {d['look_for']}" for d in load_taxonomy())
    return (
        "You are helping a home seller document one possible defect from one photo.\n"
        "Look only at what is visible. Reply with JSON only, no other text.\n\n"
        "defect_type must be exactly one of these ids:\n"
        f"{allowed}\n\n"
        "Pick the most specific id that fits what is visible.\n\n"
        "Fields:\n"
        "- severity: integer 1 (trivial) to 5 (dangerous or structural)\n"
        f"- urgency: one of {', '.join(URGENCIES)}\n"
        f"- confidence: one of {', '.join(CONFIDENCES)}. Use low if you are unsure.\n"
        f"- image_quality: one of {', '.join(QUALITIES)}. "
        "Use blurry if the photo is too blurry to judge, "
        "not_a_house if it does not show part of a home.\n"
        "- reason: one sentence, at most 20 words, describing what is visible. "
        "No costs, no legal language.\n\n"
        "If you cannot tell, use defect_type unclear and confidence low."
    )


def output_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "defect_type": {"type": "string", "enum": taxonomy_ids()},
            "severity": {"type": "integer", "minimum": 1, "maximum": 5},
            "urgency": {"type": "string", "enum": list(URGENCIES)},
            "confidence": {"type": "string", "enum": list(CONFIDENCES)},
            "image_quality": {"type": "string", "enum": list(QUALITIES)},
            "reason": {"type": "string"},
        },
        "required": ["defect_type", "severity", "urgency", "confidence", "image_quality", "reason"],
    }
