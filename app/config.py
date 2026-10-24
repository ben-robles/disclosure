import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "assets"
STATIC_DIR = ROOT / "static"
DATA_DIR = Path(os.environ.get("DISCLOSURE_DATA_DIR", ROOT / "data"))

OLLAMA_URL = os.environ.get("DISCLOSURE_OLLAMA_URL", "http://127.0.0.1:11434")
# PLACEHOLDER: the real tag is chosen in Gate 0 (docs/gate0.md). Set DISCLOSURE_MODEL to override.
MODEL = os.environ.get("DISCLOSURE_MODEL", "gemma4")
INFERENCE_TIMEOUT_S = int(os.environ.get("DISCLOSURE_TIMEOUT_S", "120"))
# Photos analyzed at once. Match Ollama's OLLAMA_NUM_PARALLEL, or extra workers just wait in line.
WORKERS = max(1, int(os.environ.get("DISCLOSURE_WORKERS", "4")))
# Keep the model in GPU memory between photos so each one skips the reload.
KEEP_ALIVE = os.environ.get("DISCLOSURE_KEEP_ALIVE", "30m")

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_IMAGE_EDGE = 1024

DISCLAIMER = "AI-assisted documentation aid. Not a home inspection and not legal advice."
OVERALL_RULE = (
    "The overall grade is the worst grade among your confirmed findings. "
    "It is never an average."
)
