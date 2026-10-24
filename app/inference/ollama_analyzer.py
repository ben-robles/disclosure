"""The only code that talks to a model. Only outbound call: local Ollama."""
import base64
import json
import re
import socket
import urllib.error
import urllib.request

from .. import config
from .analyzer import (
    CONFIDENCES, QUALITIES, URGENCIES, DefectAnalyzer, Finding, unclear_finding,
)
from .prompts import build_prompt, output_schema, taxonomy_ids


class ParseError(ValueError):
    pass


def parse_model_output(text: str) -> Finding:
    """Defensive parse: strip code fences, find the JSON object, validate every field."""
    if not isinstance(text, str) or not text.strip():
        raise ParseError("empty output")
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ParseError("no JSON object")
    try:
        data = json.loads(cleaned[start:end + 1])
    except json.JSONDecodeError as exc:
        raise ParseError(f"bad JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise ParseError("not an object")

    if data.get("defect_type") not in taxonomy_ids():
        raise ParseError("defect_type not in taxonomy")
    severity = data.get("severity")
    if isinstance(severity, str) and severity.strip().isdigit():
        severity = int(severity)
    if isinstance(severity, bool) or not isinstance(severity, int) or not 1 <= severity <= 5:
        raise ParseError("severity out of range")
    if data.get("urgency") not in URGENCIES:
        raise ParseError("bad urgency")
    if data.get("confidence") not in CONFIDENCES:
        raise ParseError("bad confidence")
    if data.get("image_quality") not in QUALITIES:
        raise ParseError("bad image_quality")
    reason = data.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise ParseError("missing reason")

    finding = Finding(
        defect_type=data["defect_type"],
        severity=severity,
        urgency=data["urgency"],
        confidence=data["confidence"],
        image_quality=data["image_quality"],
        reason=" ".join(reason.split()[:20]),
    )
    if finding.confidence == "low":
        finding.defect_type = "unclear"
    return finding


class OllamaAnalyzer(DefectAnalyzer):
    def __init__(self, base_url=None, model=None, timeout_s=None):
        self.base_url = (base_url or config.OLLAMA_URL).rstrip("/")
        self.model = model or config.MODEL
        self.timeout_s = timeout_s or config.INFERENCE_TIMEOUT_S

    def _request(self, path, payload=None, timeout=5):
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(
            self.base_url + path, data=data, headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def status(self) -> dict:
        try:
            tags = self._request("/api/tags", timeout=3)
        except (urllib.error.URLError, OSError, ValueError):
            return {
                "ready": False,
                "message": "The local AI model server (Ollama) is not running.",
                "fix": "ollama serve",
            }
        names = [m.get("name", "") for m in tags.get("models", [])]
        if not any(n == self.model or n.split(":")[0] == self.model for n in names):
            return {
                "ready": False,
                "message": f"The model '{self.model}' has not been downloaded yet.",
                "fix": f"ollama pull {self.model}",
            }
        return {"ready": True, "message": "", "fix": ""}

    def _chat_once(self, image_bytes: bytes) -> str:
        payload = {
            "model": self.model,
            "stream": False,
            "keep_alive": config.KEEP_ALIVE,
            "format": output_schema(),
            "options": {"temperature": 0},
            "messages": [{
                "role": "user",
                "content": build_prompt(),
                "images": [base64.b64encode(image_bytes).decode("ascii")],
            }],
        }
        body = self._request("/api/chat", payload, timeout=self.timeout_s)
        return body.get("message", {}).get("content", "")

    def analyze(self, image_bytes: bytes) -> Finding:
        for _attempt in range(2):
            try:
                return parse_model_output(self._chat_once(image_bytes))
            except ParseError:
                continue
            except (socket.timeout, TimeoutError):
                return unclear_finding("Analysis timed out.", "timeout")
            except urllib.error.URLError as exc:
                if isinstance(exc.reason, (socket.timeout, TimeoutError)):
                    return unclear_finding("Analysis timed out.", "timeout")
                return unclear_finding("The AI model is not reachable.", "unavailable")
            except (OSError, ValueError):
                return unclear_finding("The AI model is not reachable.", "unavailable")
        return unclear_finding("The model's answer could not be read.", "invalid")
