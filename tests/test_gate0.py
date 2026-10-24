"""Gate 0 measurements against deterministic streams; no real model required."""
import copy
import io
import json
from pathlib import Path
import urllib.error

import pytest

from scripts import gate0_ollama as gate

GOOD = dict(defect_type="water_intrusion", severity=2, urgency="1_year", confidence="high",
            image_quality="ok", reason="A small discolored patch is visible on the ceiling.")


def stream(*chunks):
    return io.BytesIO(b"\n".join(json.dumps(c).encode() if isinstance(c, dict) else c for c in chunks))


def test_stream_times_first_content_after_thinking_and_keeps_raw():
    times = iter([10, 11, 12, 12.5, 13, 14])
    seen = {}

    def opener(req, timeout):
        seen.update(json.loads(req.data))
        return stream({"message": {"thinking": "thinking only"}},
                      {"message": {"content": "Ceiling stain."}},
                      {"done": True, "total_duration": 4_000_000_000, "load_duration": 123})

    result = gate.stream_probe("gemma4:e2b", b"jpeg", opener=opener, clock=lambda: next(times))
    assert result["ok"] and result["first_content_s"] == 2.5 and result["total_s"] == 4
    assert len(result["raw_lines"]) == 3 and result["final"]["load_duration"] == 123
    assert seen["stream"] is True and seen["messages"][0]["images"] == ["anBlZw=="]


@pytest.mark.parametrize("chunks, error", [
    ([{"message": {"content": "partial"}}], "incomplete stream"),
    ([{"done": True}], "empty response"),
    ([{"error": "out of memory"}], "out of memory"),
    ([b"not JSON"], "JSONDecodeError"),
    ([{"message": {"content": "partial"}, "done": True, "done_reason": "length"}], "normally"),
    ([b"[]"], "AttributeError"),
])
def test_bad_stream_is_evidence_not_success(chunks, error):
    result = gate.stream_probe("gemma4:e2b", b"jpeg", opener=lambda *a, **k: stream(*chunks))
    assert not result["ok"] and error in result["error"] and result["raw_lines"]
    assert result["total_s"] >= 0


def test_thinking_only_never_becomes_first_content():
    result = gate.stream_probe("gemma4:e2b", b"x", opener=lambda *a, **k: stream(
        {"message": {"thinking": "hmm"}}, {"done": True}))
    assert not result["ok"] and result["first_content_s"] is None


def test_http_error_body_is_saved():
    def opener(*a, **k):
        raise urllib.error.HTTPError("local", 400, "bad schema", {}, io.BytesIO(b"schema rejected"))
    result = gate.stream_probe("gemma4:e2b", b"x", opener=opener)
    assert not result["ok"] and "HTTP 400: schema rejected" in result["error"]


def test_stream_wall_clock_limit():
    times = iter([0, 121, 122])
    result = gate.stream_probe("gemma4:e2b", b"x", clock=lambda: next(times),
                              opener=lambda *a, **k: stream({"done": True}))
    assert not result["ok"] and "budget" in result["error"]


@pytest.mark.parametrize("output, ok", [(GOOD, True), ({**GOOD, "severity": 9}, False)])
def test_structured_probe_uses_production_schema_and_parser(output, ok):
    def opener(req, timeout):
        payload = json.loads(req.data)
        assert payload["format"] == gate.output_schema()
        assert payload["messages"][0]["content"] == gate.build_prompt()
        return stream({"message": {"content": json.dumps(output)}}, {"done": True})
    result = gate.stream_probe("gemma4:e2b", b"x", structured=True, opener=opener)
    assert result["ok"] is ok


def test_benchmark_keeps_failed_findings_and_all_three_batches():
    calls = []
    def probe(model, image):
        calls.append(image)
        return {"ok": image != b"bad", "total_s": 1, "error": "invalid" if image == b"bad" else None}
    result = gate.benchmark("gemma4:e2b", [b"good", b"bad"], 4, probe=probe)
    assert len(calls) == 14  # two warmups, then three batches of four
    assert result["failures"] == 6
    assert [b["failures"] for b in result["batches"]] == [2, 2, 2]
    assert all(len(b["photos"]) == 4 for b in result["batches"])


def measured_run(workers, batch_time=20):
    probe = {"ok": True, "total_s": 2, "first_content_s": 1, "content": "visible defect"}
    photo = {"file": "one.jpg", "sha256": "first", **{key: copy.deepcopy(probe)
             for key in ("initial", "warm", "structured", "production", "cli")}}
    return {"model": "gemma4:e2b", "prompt_version": "v1", "workers": workers,
            "platform": "Windows-11", "environment": {"machine": "demo", "run_id": "same"},
            "tags": {"models": [{"name": "gemma4:e2b", "digest": "abc", "size": 123}]},
            "photos": [photo, {**copy.deepcopy(photo), "file": "two.jpg", "sha256": "second"}],
            "benchmark": {"warmups": [probe, probe], "failures": 0, "median_batch_s": batch_time,
                          "batches": [{"repeat": i + 1, "total_s": batch_time, "failures": 0,
                                       "photos": [probe] * 4} for i in range(3)]}}


@pytest.mark.parametrize("time, expected", [(10, 4), (20, 1), (30, 1)])
def test_worker_choice_requires_a_faster_parallel_median(time, expected):
    result = gate.compare_runs(measured_run(1), measured_run(4, time))
    assert result["recommended_workers"] == expected
    assert result["status"] == "review_required"  # never auto-certify image specificity


def test_fast_failed_parallel_run_does_not_win():
    four = measured_run(4, 1)
    four["benchmark"]["failures"] = 1
    result = gate.compare_runs(measured_run(1), four)
    assert result["recommended_workers"] == 1 and not result["parallel_ok"]


@pytest.mark.parametrize("field, value", [("model", "gemma4:e4b"), ("platform", "Darwin"),
                                          ("environment", {"machine": "other"})])
def test_mismatched_comparisons_rejected(field, value):
    four = measured_run(4)
    four[field] = value
    with pytest.raises(ValueError):
        gate.compare_runs(measured_run(1), four)


def test_model_digest_mismatch_rejected():
    four = measured_run(4)
    four["tags"]["models"][0]["digest"] = "changed"
    with pytest.raises(ValueError, match="digest"):
        gate.compare_runs(measured_run(1), four)


def test_sequential_failure_cannot_certify():
    one = measured_run(1)
    one["photos"][0]["production"]["ok"] = False
    assert gate.compare_runs(one, measured_run(4))["status"] == "failed"


def test_missing_or_slow_batch_measurements_fail():
    run = measured_run(1)
    run["benchmark"]["batches"][0]["photos"] = []
    assert not gate.measurements_ok(run)
    run = measured_run(1)
    run["photos"][0]["warm"]["total_s"] = 61
    assert not gate.measurements_ok(run)


def test_suite_refuses_mac_measurements(monkeypatch, tmp_path):
    monkeypatch.setattr(gate.platform, "system", lambda: "Darwin")
    with pytest.raises(ValueError, match="Windows"):
        gate.run_suite("gemma4:e2b", [Path("a.jpg"), Path("b.jpg")], 1, tmp_path / "run.json", {})


def test_report_records_errors_and_requires_image_review(tmp_path):
    one, four = measured_run(1), measured_run(4, 10)
    four["photos"][0]["production"]["error"] = "out of memory"
    four["photos"][0]["production"]["ok"] = False
    comparison = gate.compare_runs(one, four)
    gate.render_reports(one, four, comparison, tmp_path)
    report = (tmp_path / "gate0.md").read_text()
    assert "out of memory" in report and "review_required" in report
    assert "unavailable" in report and "No first-token estimate" in report
    assert (tmp_path / "environment.md").exists()


def test_fixture_images_are_distinct_sanitized_and_small():
    from PIL import Image
    paths = [gate.ROOT / "assets/test_photos" / name for name in
             ("gate0_water_stain.jpg", "gate0_chimney_spalling.jpg")]
    assert paths[0].read_bytes() != paths[1].read_bytes()
    for path in paths:
        with Image.open(path) as image:
            assert image.format == "JPEG" and max(image.size) <= 1024
            assert not image.getexif()


def test_production_probe_retains_invalid_reply_and_retry(monkeypatch):
    replies = iter([{"message": {"content": "bad JSON"}},
                    {"message": {"content": json.dumps(GOOD)}}])
    monkeypatch.setattr(gate.OllamaAnalyzer, "_request", lambda *a, **k: next(replies))
    result = gate.production_probe("gemma4:e2b", b"photo")
    assert result["ok"] and len(result["attempts"]) == 2
    assert result["attempts"][0]["response"]["message"]["content"] == "bad JSON"


def test_cli_timeout_retains_partial_output(monkeypatch):
    def timeout(*a, **k):
        assert a[0][-1].endswith("./photo.jpg")
        assert k["cwd"] == Path("photo.jpg").parent.resolve()
        raise gate.subprocess.TimeoutExpired("ollama", 180, output=b"partial reply", stderr=b"loading")
    monkeypatch.setattr(gate.subprocess, "run", timeout)
    result = gate.cli_probe("gemma4:e2b", Path("photo.jpg"))
    assert not result["ok"] and result["stdout"] == "partial reply" and result["stderr"] == "loading"


def test_suite_saves_failure_if_model_has_no_vision(monkeypatch, tmp_path):
    monkeypatch.setattr(gate.platform, "system", lambda: "Windows")
    monkeypatch.setenv("OLLAMA_NUM_PARALLEL", "1")
    monkeypatch.setattr(gate, "local_request", lambda *a: {"capabilities": ["completion"]})
    output = tmp_path / "workers-1.json"
    result = gate.run_suite("gemma4:e2b", [Path("a.jpg"), Path("b.jpg")], 1, output, {})
    assert "vision" in result["error"] and json.loads(output.read_text())["error"]
    assert not gate.measurements_ok(result)


def test_suite_exercises_both_photos_and_saves_evidence(monkeypatch, tmp_path, jpeg):
    monkeypatch.setattr(gate.platform, "system", lambda: "Windows")
    monkeypatch.setenv("OLLAMA_NUM_PARALLEL", "1")
    requests = []
    def request(path, payload=None):
        requests.append((path, payload))
        return {"capabilities": ["vision"]}
    monkeypatch.setattr(gate, "local_request", request)
    calls = []
    def probe(model, image, structured=False):
        calls.append(structured)
        return {"ok": True, "total_s": 1, "first_content_s": .5}
    monkeypatch.setattr(gate, "stream_probe", probe)
    monkeypatch.setattr(gate, "production_probe", lambda *a: {"ok": True, "total_s": 1})
    monkeypatch.setattr(gate, "cli_probe", lambda *a: {"ok": True, "total_s": 1})
    monkeypatch.setattr(gate, "benchmark", lambda *a: measured_run(1)["benchmark"])
    photos = [tmp_path / "a.jpg", tmp_path / "b.jpg"]
    for photo, color in zip(photos, [(100, 20, 40), (30, 80, 150)]):
        photo.write_bytes(jpeg(color=color, exif=True))
    output = tmp_path / "evidence/workers-1.json"
    result = gate.run_suite("gemma4:e2b", photos, 1, output, {})
    assert gate.measurements_ok(result)
    assert calls == [False, False, True, False, False, True]
    assert ("/api/generate", {"model": "gemma4:e2b", "keep_alive": 0}) in requests
    assert len(json.loads(output.read_text())["photos"]) == 2
    assert (output.parent / "a-sanitized.jpg").exists()


def test_original_positional_invocation_sanitizes_and_records_errors(monkeypatch, tmp_path, jpeg):
    photo = tmp_path / "input.jpg"
    photo.write_bytes(jpeg(exif=True))
    def probe(model, image, structured):
        from PIL import Image
        with Image.open(io.BytesIO(image)) as prepared:
            assert max(prepared.size) <= 1024 and not prepared.getexif()
        return {"ok": False, "error": "incomplete stream", "content": "partial",
                "first_content_s": .2, "total_s": 1}
    monkeypatch.setattr(gate, "stream_probe", probe)
    output = tmp_path / "evidence.json"
    assert gate.main(["gemma4:e2b", str(photo), "--output", str(output)]) == 1
    assert json.loads(output.read_text())["error"] == "incomplete stream"
