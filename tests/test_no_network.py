"""The only network address the app may mention is local."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = re.compile(r"https?://[^\s\"'<>)\]]+")
# The \$\( branch is run.ps1 printing this computer's own LAN address for a phone (-Lan).
ALLOWED = re.compile(r"^https?://((127\.0\.0\.1|localhost)(:(\d+|\$\w+))?([/?#].*)?|\$\(.*)$")
FOLDERS = ("app", "static", "scripts", "cloud")
SUFFIXES = {".py", ".js", ".html", ".css", ".ps1"}
EXTRA_FILES = ("run.ps1",)


def _scan(path: Path, offenders: list[str]) -> None:
    for url in URL.findall(path.read_text(encoding="utf-8")):
        if not ALLOWED.match(url):
            offenders.append(f"{path.relative_to(ROOT)}: {url}")


def find_offenders() -> list[str]:
    offenders: list[str] = []
    for folder in FOLDERS:
        base = ROOT / folder
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if path.is_file() and (path.suffix in SUFFIXES or path.name == "Dockerfile"):
                _scan(path, offenders)
    for name in EXTRA_FILES:
        path = ROOT / name
        if path.is_file():
            _scan(path, offenders)
    return offenders


def test_no_external_urls_in_code():
    assert not find_offenders(), find_offenders()


def test_scanner_covers_cloud_and_powershell(tmp_path, monkeypatch):
    from tests import test_no_network as mod
    (tmp_path / "cloud").mkdir()
    (tmp_path / "cloud" / "deploy.ps1").write_text('Write-Host "https://evil.example"', encoding="utf-8")
    (tmp_path / "cloud" / "Dockerfile").write_text("FROM x\n# https://evil2.example\n", encoding="utf-8")
    for f in ("app", "static", "scripts"):
        (tmp_path / f).mkdir()
    monkeypatch.setattr(mod, "ROOT", tmp_path)
    offenders = mod.find_offenders()
    assert any("deploy.ps1" in o and "evil.example" in o for o in offenders)
    assert any("Dockerfile" in o and "evil2.example" in o for o in offenders)
