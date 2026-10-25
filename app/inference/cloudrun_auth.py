"""ID token for calling a private Cloud Run service from another Cloud Run service.

Only used when the app itself runs on Cloud Run (DISCLOSURE_OLLAMA_AUTH=cloudrun). The
token comes from the metadata server, lasts an hour, and is cached for 50 minutes.
"""
import threading
import time
import urllib.parse
import urllib.request

METADATA_IDENTITY = (
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"
)
CACHE_SECONDS = 50 * 60

_lock = threading.Lock()
_cache: dict[str, tuple[str, float]] = {}


def identity_token(audience: str) -> str:
    """Return a fresh-enough ID token for `audience`, or raise OSError if the metadata server fails."""
    with _lock:
        cached = _cache.get(audience)
        if cached and time.monotonic() < cached[1]:
            return cached[0]
        query = urllib.parse.urlencode({"audience": audience})
        req = urllib.request.Request(
            f"{METADATA_IDENTITY}?{query}", headers={"Metadata-Flavor": "Google"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            token = resp.read().decode("utf-8").strip()
        _cache[audience] = (token, time.monotonic() + CACHE_SECONDS)
        return token
