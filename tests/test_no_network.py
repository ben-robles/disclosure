"""The only network address the app may mention is local."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = re.compile(r"https?://[^\s\"'<>)\]]+")
ALLOWED = re.compile(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?([/?#].*)?$")


def test_no_external_urls_in_code():
    offenders = []
    for folder in ("app", "static", "scripts"):
        for path in (ROOT / folder).rglob("*"):
            if path.suffix not in {".py", ".js", ".html", ".css"} or not path.is_file():
                continue
            for url in URL.findall(path.read_text(encoding="utf-8")):
                if not ALLOWED.match(url):
                    offenders.append(f"{path.relative_to(ROOT)}: {url}")
    assert not offenders, offenders
