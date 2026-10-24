import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Read KEY=value lines from a gitignored .env so secrets never live in the code."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_dotenv(ROOT / ".env")
ASSETS_DIR = ROOT / "assets"
STATIC_DIR = ROOT / "static"
DATA_DIR = Path(os.environ.get("DISCLOSURE_DATA_DIR", ROOT / "data"))

OLLAMA_URL = os.environ.get("DISCLOSURE_OLLAMA_URL", "http://127.0.0.1:11434")
# PLACEHOLDER: the real tag is chosen in Gate 0 (docs/gate0.md). Set DISCLOSURE_MODEL to override.
MODEL = os.environ.get("DISCLOSURE_MODEL", "gemma4")
INFERENCE_TIMEOUT_S = int(os.environ.get("DISCLOSURE_TIMEOUT_S", "120"))
# Start conservatively until Windows Gate 0 measures a benefit from four workers.
# Match Ollama's OLLAMA_NUM_PARALLEL, or extra workers just wait in line.
WORKERS = max(1, int(os.environ.get("DISCLOSURE_WORKERS", "1")))
# Keep the model in GPU memory between photos so each one skips the reload.
KEEP_ALIVE = os.environ.get("DISCLOSURE_KEEP_ALIVE", "30m")

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_IMAGE_EDGE = 1024

DISCLAIMER = "AI-assisted documentation aid. Not a home inspection and not legal advice."
OVERALL_RULE = (
    "The overall grade is the worst grade among your confirmed findings. "
    "It is never an average."
)

# Optional: emailing a finished report. Unset means the feature reports "not set up".
SMTP_HOST = os.environ.get("DISCLOSURE_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("DISCLOSURE_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("DISCLOSURE_SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("DISCLOSURE_SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("DISCLOSURE_SMTP_FROM", SMTP_USER)
