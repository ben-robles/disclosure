"""Exercise OllamaAnalyzer against a local stub server. No Gemma involved:
this checks the request shape, retry, timeout and status handling only."""
import json
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.inference.ollama_analyzer import OllamaAnalyzer

GOOD = json.dumps(dict(defect_type="roof", severity=2, urgency="1_year", confidence="high",
                       image_quality="ok", reason="Curling shingles."))


def serve(handler_fn):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            handler_fn(self, None)

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            handler_fn(self, body)

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_port}"


def reply(h, obj):
    data = json.dumps(obj).encode()
    h.send_response(200)
    h.send_header("Content-Type", "application/json")
    h.send_header("Content-Length", str(len(data)))
    h.end_headers()
    h.wfile.write(data)


@pytest.fixture
def stub():
    servers = []

    def make(fn):
        srv, url = serve(fn)
        servers.append(srv)
        return url

    yield make
    for s in servers:
        s.shutdown()


def test_request_shape_and_success(stub):
    seen = {}

    def fn(h, body):
        seen.update(body)
        reply(h, {"message": {"content": GOOD}})

    a = OllamaAnalyzer(stub(fn), "m", 5)
    f = a.analyze(b"\xff\xd8jpegbytes")
    assert f.defect_type == "roof" and f.analysis_status == "ok"
    assert seen["model"] == "m" and seen["stream"] is False
    assert seen["messages"][0]["images"]            # base64 image attached
    assert seen["format"]["properties"]["defect_type"]["enum"]


def test_retries_once_then_succeeds(stub):
    calls = []

    def fn(h, body):
        calls.append(1)
        reply(h, {"message": {"content": "garbage" if len(calls) == 1 else GOOD}})

    f = OllamaAnalyzer(stub(fn), "m", 5).analyze(b"x")
    assert f.defect_type == "roof" and len(calls) == 2


def test_two_bad_answers_become_unclear_invalid(stub):
    def fn(h, body):
        reply(h, {"message": {"content": "not json"}})

    f = OllamaAnalyzer(stub(fn), "m", 5).analyze(b"x")
    assert (f.defect_type, f.analysis_status) == ("unclear", "invalid")


def test_timeout_is_reported_not_raised(stub):
    def fn(h, body):
        time.sleep(1.5)
        reply(h, {"message": {"content": GOOD}})

    f = OllamaAnalyzer(stub(fn), "m", 1).analyze(b"x")
    assert (f.defect_type, f.analysis_status) == ("unclear", "timeout")


def test_unreachable_server(tmp_path):
    f = OllamaAnalyzer("http://127.0.0.1:9", "m", 6).analyze(b"x")
    assert (f.defect_type, f.analysis_status) == ("unclear", "unavailable")


def test_status_messages(stub):
    try:
        urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=1)
    except OSError:
        pass
    else:
        pytest.skip("local Ollama is running")
    down = OllamaAnalyzer("http://127.0.0.1:11434", "gemma-x").status()
    assert not down["ready"] and down["fix"] == "ollama serve"

    url = stub(lambda h, b: reply(h, {"models": [{"name": "other:latest"}]}))
    missing = OllamaAnalyzer(url, "gemma-x").status()
    assert not missing["ready"] and missing["fix"] == "ollama pull gemma-x"

    url2 = stub(lambda h, b: reply(h, {"models": [{"name": "gemma-x:latest"}]}))
    assert OllamaAnalyzer(url2, "gemma-x").status()["ready"]


def test_bearer_header_sent_when_token_set(stub):
    seen = {}

    def fn(h, body):
        seen["auth"] = h.headers.get("Authorization")
        reply(h, {"message": {"content": GOOD}})

    OllamaAnalyzer(stub(fn), "m", 5, token="abc123").analyze(b"x")
    assert seen["auth"] == "Bearer abc123"


def test_no_auth_header_when_token_empty_or_blank(stub):
    seen = {}

    def fn(h, body):
        seen["auth"] = h.headers.get("Authorization")
        reply(h, {"message": {"content": GOOD}})

    OllamaAnalyzer(stub(fn), "m", 5, token="").analyze(b"x")
    assert seen["auth"] is None
    OllamaAnalyzer(stub(fn), "m", 5, token="   ").analyze(b"x")
    assert seen["auth"] is None


def test_status_hosted_unreachable_points_at_proxy():
    # port 9 is not 11434, so this URL counts as hosted
    down = OllamaAnalyzer("http://127.0.0.1:9", "gemma-x").status()
    assert not down["ready"]
    assert down["message"] == "The hosted AI model server is not reachable."
    assert down["fix"] == "gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"
