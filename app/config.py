import os
from pathlib import Path
from urllib.parse import urlsplit

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
DATA_DIR = Path(os.environ.get("DISCLOSURE_DATA_DIR", ROOT / "data"))

# Ollama on this computer, or the Cloud Run proxy on port 9090 (see cloud/README.md).
OLLAMA_URL = os.environ.get("DISCLOSURE_OLLAMA_URL", "http://127.0.0.1:11434")


def is_local_url(url: str) -> bool:
    """True only for Ollama's own default address; the Cloud Run proxy port counts as hosted."""
    parts = urlsplit(url)
    try:
        port = parts.port
    except ValueError:
        return False
    return (parts.hostname or "").lower() in {"127.0.0.1", "localhost"} and port == 11434


OLLAMA_IS_LOCAL = is_local_url(OLLAMA_URL)
# "cloudrun" when this app runs on Cloud Run and calls the private model service directly.
OLLAMA_AUTH = os.environ.get("DISCLOSURE_OLLAMA_AUTH", "").strip().lower()
# Only for a direct IAM identity token; empty when going through the gcloud proxy.
OLLAMA_TOKEN = os.environ.get("DISCLOSURE_OLLAMA_TOKEN", "").strip()
PROXY_FIX = "gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"
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

# Optional TypeSafe (Jev) text judge. Empty URL means the whole feature is off.
# Only Gemma's short text (reason, title, typed fields) is ever sent; never photos.
TYPESAFE_URL = os.environ.get("DISCLOSURE_TYPESAFE_URL", "").strip()
TYPESAFE_API_KEY = os.environ.get("TYPESAFE_API_KEY", "").strip()
TYPESAFE_MODEL = os.environ.get("DISCLOSURE_TYPESAFE_MODEL", "jev-latest").strip() or "jev-latest"
TYPESAFE_TIMEOUT_S = float(os.environ.get("DISCLOSURE_TYPESAFE_TIMEOUT_S", "10"))


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


# Feature 2: second opinion on each finding. Feature 3: Jev picks the defect type and sets confidence.
JUDGE_VERIFY = _flag("DISCLOSURE_JUDGE_VERIFY")
JUDGE_CLASSIFY = _flag("DISCLOSURE_JUDGE_CLASSIFY")
# Noul answers above YES count as yes, below NO as no; in between is left alone.
JUDGE_YES = float(os.environ.get("DISCLOSURE_JUDGE_YES", "0.7"))
JUDGE_NO = float(os.environ.get("DISCLOSURE_JUDGE_NO", "0.3"))
# Feature 3: top-choice probability at or above HIGH is high confidence, at or above MEDIUM medium.
JUDGE_CONF_HIGH = float(os.environ.get("DISCLOSURE_JUDGE_CONF_HIGH", "0.75"))
JUDGE_CONF_MEDIUM = float(os.environ.get("DISCLOSURE_JUDGE_CONF_MEDIUM", "0.45"))
