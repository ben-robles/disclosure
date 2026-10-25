import io
import json
import urllib.request

from app import config
from app.inference import cloudrun_auth
from app.inference.ollama_analyzer import OllamaAnalyzer


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _fake_urlopen(calls, token="tok-1"):
    def fn(req, timeout=None):
        calls.append(req)
        return _Resp(token.encode())
    return fn


def test_identity_token_asks_metadata_server_and_caches(monkeypatch):
    cloudrun_auth._cache.clear()
    calls = []
    monkeypatch.setattr(urllib.request, "urlopen", _fake_urlopen(calls))
    aud = "https://model.example.run.app"
    assert cloudrun_auth.identity_token(aud) == "tok-1"
    assert cloudrun_auth.identity_token(aud) == "tok-1"
    assert len(calls) == 1
    assert calls[0].get_header("Metadata-flavor") == "Google"
    assert "audience=https%3A%2F%2Fmodel.example.run.app" in calls[0].full_url


def test_identity_token_refreshes_after_expiry(monkeypatch):
    cloudrun_auth._cache.clear()
    calls = []
    monkeypatch.setattr(urllib.request, "urlopen", _fake_urlopen(calls))
    aud = "https://model.example.run.app"
    cloudrun_auth.identity_token(aud)
    token, _ = cloudrun_auth._cache[aud]
    cloudrun_auth._cache[aud] = (token, 0.0)
    cloudrun_auth.identity_token(aud)
    assert len(calls) == 2


def test_analyzer_sends_id_token_on_cloudrun(monkeypatch):
    monkeypatch.setattr(config, "OLLAMA_AUTH", "cloudrun")
    monkeypatch.setattr(cloudrun_auth, "identity_token", lambda aud: f"id-for-{aud}")
    seen = []

    def fake(req, timeout=None):
        seen.append(req)
        return _Resp(json.dumps({"models": [{"name": "m"}]}).encode())

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    st = OllamaAnalyzer("https://model.example.run.app", "m", token="").status()
    assert st["ready"]
    assert seen[0].get_header("Authorization") == "Bearer id-for-https://model.example.run.app"


def test_cloudrun_unreachable_message_has_no_laptop_fix(monkeypatch):
    monkeypatch.setattr(config, "OLLAMA_AUTH", "cloudrun")
    monkeypatch.setattr(cloudrun_auth, "identity_token", lambda aud: "t")
    st = OllamaAnalyzer("http://127.0.0.1:9", "m", token="").status()
    assert not st["ready"] and st["fix"] == ""
    assert "waking up" in st["message"]
