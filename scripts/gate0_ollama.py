"""Measure local Gemma vision; successful requests alone do not certify Gate 0.

    python scripts/gate0_ollama.py gemma4:e2b photo.jpg
    python scripts/gate0_ollama.py gemma4:e2b photo.jpg --suite --other-photo other.jpg --workers 1

Use gate0_windows.ps1 for controlled Windows server restarts and telemetry.
Raw replies and measurements are saved under data/gate0/ by default.
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import config  # noqa: E402
from app.images import sanitize  # noqa: E402
from app.inference.ollama_analyzer import OllamaAnalyzer, parse_model_output  # noqa: E402
from app.inference.prompts import PROMPT_VERSION, build_prompt, output_schema  # noqa: E402

BASE_URL = "http://127.0.0.1:11434"
QUESTION = "Describe the visible defect in one sentence and rate severity 1 to 5."


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def local_request(path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE_URL + path, data, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def stream_probe(model, image, structured=False, opener=urllib.request.urlopen,
                 clock=time.perf_counter, timeout=120):
    """Time first nonempty content chunk, excluding thinking; retain raw NDJSON.

    EOF without done, empty output, schema failure and truncation fail the probe.
    First-content receipt is an observation, not model-internal first-token time.
    """
    payload = {
        "model": model, "stream": True, "keep_alive": config.KEEP_ALIVE,
        "options": {"temperature": 0},
        "messages": [{"role": "user", "content": build_prompt() if structured else QUESTION,
                      "images": [base64.b64encode(image).decode("ascii")]}],
    }
    if structured:
        payload["format"] = output_schema()
    req = urllib.request.Request(BASE_URL + "/api/chat", json.dumps(payload).encode(),
                                 {"Content-Type": "application/json"})
    result = {"ok": False, "content": "", "first_content_s": None, "total_s": None,
              "raw_lines": [], "final": None, "error": None, "structured": structured}
    start = clock()
    try:
        with opener(req, timeout=timeout) as response:
            for line in response:
                if clock() - start > timeout:
                    raise TimeoutError("stream exceeded wall-clock budget")
                raw = line.decode("utf-8").rstrip("\r\n")
                result["raw_lines"].append(raw)
                if not raw.strip():
                    continue
                chunk = json.loads(raw)
                if chunk.get("error"):
                    raise ValueError(str(chunk["error"]))
                content = chunk.get("message", {}).get("content", "")
                if content:
                    if result["first_content_s"] is None:
                        result["first_content_s"] = clock() - start
                    result["content"] += content
                if chunk.get("done") is True:
                    result["final"] = chunk
                    break
        if result["final"] is None:
            raise ValueError("incomplete stream: no done event")
        if result["final"].get("done_reason", "stop") != "stop":
            raise ValueError("generation did not finish normally")
        if not result["content"].strip():
            raise ValueError("empty response content")
        if structured:
            result["finding"] = asdict(parse_model_output(result["content"]))
        result["ok"] = True
    except urllib.error.HTTPError as exc:
        result["error"] = f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}"
    except (OSError, ValueError, TypeError, AttributeError) as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    result["total_s"] = clock() - start
    return result


class RecordingAnalyzer(OllamaAnalyzer):
    """Production behavior with raw chat attempts saved, including retries."""

    def __init__(self, model):
        super().__init__(BASE_URL, model, 120)
        self.attempts = []

    def _request(self, path, payload=None, timeout=5):
        record = {"path": path}
        start = time.perf_counter()
        try:
            body = super()._request(path, payload, timeout)
            record["response"] = body
            return body
        except urllib.error.HTTPError as exc:
            record["error"] = f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}"
            raise
        except (OSError, ValueError) as exc:
            record["error"] = str(exc)
            raise
        finally:
            record["total_s"] = time.perf_counter() - start
            self.attempts.append(record)


def production_probe(model, image):
    analyzer = RecordingAnalyzer(model)
    start = time.perf_counter()
    result = {"ok": False, "error": None}
    try:
        finding = analyzer.analyze(image)
        result.update(finding=asdict(finding), ok=finding.analysis_status == "ok")
        if not result["ok"]:
            result["error"] = finding.analysis_status + ": " + finding.reason
    except Exception as exc:
        # Keep unexpected failures as evidence rather than discard the run.
        result["error"] = f"{type(exc).__name__}: {exc}"
    result.update(total_s=time.perf_counter() - start, attempts=analyzer.attempts)
    return result


def cli_probe(model, photo):
    start = time.perf_counter()
    try:
        proc = subprocess.run(["ollama", "run", model, f"{QUESTION} ./{photo.name}"],
                              cwd=photo.parent.resolve(),
                              capture_output=True, text=True, encoding="utf-8",
                              errors="replace", timeout=180)
        return {"ok": proc.returncode == 0 and bool(proc.stdout.strip()),
                "returncode": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr,
                "total_s": time.perf_counter() - start}
    except subprocess.TimeoutExpired as exc:
        decode = lambda value: value.decode("utf-8", errors="replace") if isinstance(value, bytes) else value
        return {"ok": False, "error": str(exc), "stdout": decode(exc.stdout),
                "stderr": decode(exc.stderr), "total_s": time.perf_counter() - start}
    except OSError as exc:
        return {"ok": False, "error": str(exc), "total_s": time.perf_counter() - start}


def benchmark(model, images, workers, probe=production_probe, clock=time.perf_counter):
    """Three warmed four-photo batches. Each task owns its recording analyzer."""
    warmups = [probe(model, image) for image in images]
    batches = []
    for repeat in range(3):
        start = clock()
        with ThreadPoolExecutor(max_workers=workers) as pool:
            results = list(pool.map(lambda image: probe(model, image), images * 2))
        batches.append({"repeat": repeat + 1, "total_s": clock() - start,
                        "photos": results, "failures": sum(not r["ok"] for r in results)})
    return {"warmups": warmups, "batches": batches,
            "median_batch_s": statistics.median(b["total_s"] for b in batches),
            "failures": sum(b["failures"] for b in batches)}


def run_suite(model, photos, workers, output, environment):
    if len(photos) != 2 or photos[0].resolve() == photos[1].resolve():
        raise ValueError("suite requires two different photo files")
    if platform.system() != "Windows":
        raise ValueError("Gate 0 certification suite must run on the Windows demo laptop")
    if os.environ.get("OLLAMA_NUM_PARALLEL") != str(workers):
        raise ValueError("use gate0_windows.ps1 to match server parallelism and workers")
    result = {"model": model, "workers": workers, "platform": platform.platform(),
              "prompt_version": PROMPT_VERSION, "recorded_at": datetime.now(timezone.utc).isoformat(),
              "environment": environment, "photos": [], "error": None}
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        result["ollama_version"] = local_request("/api/version")
        result["tags"] = local_request("/api/tags")
        result["show"] = local_request("/api/show", {"model": model})
        if "vision" not in result["show"].get("capabilities", []):
            raise ValueError("ollama show does not advertise vision")
        images = [sanitize(photo.read_bytes()) for photo in photos]
        # The first HTTP observation includes a cold model load.
        local_request("/api/generate", {"model": model, "keep_alive": 0})
        for photo, image in zip(photos, images):
            prepared = output.parent / (photo.stem + "-sanitized.jpg")
            prepared.write_bytes(image)
            record = {"file": photo.name, "sha256": hashlib.sha256(image).hexdigest()}
            result["photos"].append(record)
            record["initial"] = stream_probe(model, image)
            record["warm"] = stream_probe(model, image)
            record["structured"] = stream_probe(model, image, structured=True)
            record["production"] = production_probe(model, image)
            record["cli"] = cli_probe(model, prepared)
            write_json(output, result)
        result["benchmark"] = benchmark(model, images, workers)
        result["loaded_models"] = local_request("/api/ps")
    except (OSError, ValueError) as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        write_json(output, result)
    return result


def measurements_ok(run):
    """Technical checks only; image specificity must be reviewed separately."""
    photos = run.get("photos", [])
    bench = run.get("benchmark", {})
    return bool(
        not run.get("error") and len(photos) == 2
        and all(all(p.get(key, {}).get("ok") for key in
                    ("initial", "warm", "structured", "production", "cli")) for p in photos)
        and all(p["warm"]["total_s"] < 60 and p["production"]["total_s"] < 60 for p in photos)
        and len(bench.get("batches", [])) == 3
        and len(bench.get("warmups", [])) == 2 and all(r["ok"] for r in bench["warmups"])
        and bench.get("failures", 1) == 0
        and all(len(b.get("photos", [])) == 4 and all(p["ok"] and p["total_s"] < 60
                for p in b["photos"]) for b in bench.get("batches", []))
    )


def compare_runs(one, four):
    """Reject mismatched evidence; failed/faster parallel runs must never win."""
    for key in ("model", "prompt_version", "environment"):
        if one.get(key) != four.get(key):
            raise ValueError(f"runs have different {key}")
    if one.get("workers") != 1 or four.get("workers") != 4:
        raise ValueError("comparison needs worker settings 1 then 4")
    if not all(r.get("platform", "").startswith("Windows") for r in (one, four)):
        raise ValueError("comparison requires Windows measurements")
    identities = lambda run: [(p["file"], p["sha256"]) for p in run.get("photos", [])]
    if identities(one) != identities(four):
        raise ValueError("runs have different photos")
    digests = lambda run: sorted((m["name"], m["digest"]) for m in run.get("tags", {}).get("models", [])
                                if m["name"] == run["model"])
    if not digests(one) or digests(one) != digests(four):
        raise ValueError("selected model digest is missing or different")
    sequential_ok = measurements_ok(one)
    parallel_ok = measurements_ok(four)
    winner = 1
    if sequential_ok and parallel_ok and four["benchmark"]["median_batch_s"] < one["benchmark"]["median_batch_s"]:
        winner = 4
    return {"status": "review_required" if sequential_ok else "failed",
            "recommended_workers": winner, "sequential_ok": sequential_ok,
            "parallel_ok": parallel_ok,
            "note": "Review image-specific CLI, HTTP and production replies before certifying Gate 0."}


def render_reports(one, four, comparison, directory):
    """Write reviewable drafts alongside raw evidence; never mark the gate passed."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    lines = ["# Gate 0 measurements", "", "Status: **" + comparison["status"] + "**.", "",
             "Image-specific review is still required. These are measurements, not certification.", "",
             f"Model: `{one['model']}`. Prompt: `{one['prompt_version']}`.", "",
             f"Recommended workers after successful image review: **{comparison['recommended_workers']}**.", "",
             "Times are seconds. First-content time is measured from streamed content receipt;",
             "thinking chunks are excluded. No first-token estimate is made for production/CLI calls.", ""]
    for run in (one, four):
        workers = run["workers"]
        lines += [f"## {workers} worker(s)", "", f"Technical checks: {measurements_ok(run)}.", "",
                  "Selected model metadata:", "", "```json",
                  json.dumps([m for m in run.get("tags", {}).get("models", [])
                              if m["name"] == run["model"]], indent=2), "```", ""]
        if run.get("error"):
            lines += ["Run error: " + run["error"], ""]
        for index, photo in enumerate(run.get("photos", [])):
            lines += [f"### {photo['file']}", "", f"Sanitized SHA-256: `{photo['sha256']}`.", "",
                      "| Probe | OK | First content | Total | Load | Eval |",
                      "|---|---|---|---|---|---|"]
            for key in ("initial", "warm", "structured", "production", "cli"):
                r = photo.get(key, {})
                final = r.get("final") or {}
                stats = [final] if final else [a["response"] for a in r.get("attempts", [])
                                             if "response" in a]
                load = f"{sum(s.get('load_duration', 0) for s in stats) / 1e9:.3f}" if stats else "n/a"
                evaluation = f"{sum(s.get('eval_duration', 0) for s in stats) / 1e9:.3f}" if stats else "n/a"
                label = "cold HTTP (after unload)" if key == "initial" and index == 0 else key
                lines.append(f"| {label} | {r.get('ok')} | {r.get('first_content_s', 'n/a')} | "
                             f"{r.get('total_s', 'n/a')} | {load} | {evaluation} |")
            for key in ("initial", "warm", "structured", "production", "cli"):
                r = photo.get(key, {})
                lines += ["", f"{key} reply:", "", "```json", json.dumps(r, indent=2, ensure_ascii=False), "```"]
            lines += [""]
        bench = run.get("benchmark", {})
        lines += ["| Repeat | Batch duration | Failures | Per-photo duration |",
                  "|---|---|---|---|"]
        for batch in bench.get("batches", []):
            latencies = ", ".join(f"{p['total_s']:.3f}" for p in batch["photos"])
            lines.append(f"| {batch['repeat']} | {batch['total_s']:.3f} | {batch['failures']} | {latencies} |")
        lines += ["", f"Median batch duration: {bench.get('median_batch_s', 'unavailable')} s.", ""]
        samples_path = directory / f"resources-{workers}.jsonl"
        samples = []
        if samples_path.exists():
            for line in samples_path.read_text(encoding="utf-8-sig").splitlines():
                try:
                    samples.append(json.loads(line))
                except ValueError:
                    pass  # Sampler shutdown may leave a final partial line; raw file remains.
        memory = [s["ollama_working_set_bytes"] for s in samples if s.get("ollama_working_set_bytes") is not None]
        available = [s["system_available_bytes"] for s in samples if s.get("system_available_bytes") is not None]
        lines += [f"Resource samples: {len(samples)}; sampled peak Ollama process working set: "
                  f"{max(memory) if memory else 'unavailable'} bytes; minimum system available memory: "
                  f"{min(available) if available else 'unavailable'} bytes.", "",
                  f"GPU memory/utilization samples: `resources-{workers}.jsonl` (NVIDIA only; null if unavailable).",
                  "Sampling is once per second across probes and benchmarks, not a guaranteed absolute peak.", "",
                  "Loaded model allocation:", "", "```json", json.dumps(run.get("loaded_models"), indent=2), "```", ""]
    lines += ["## Review and record", "",
              "Compare every CLI, HTTP and production reply with both fixture photos and their attribution file.",
              "Confirm the ceiling stain/peeling area and the crumbling brick chimney are distinguished.",
              "Record reviewer, date, and image-specific evidence. Generic answers fail even with valid JSON.",
              "Only after passing, copy this report to docs/gate0.md and environment.md to docs/environment.md;",
              "set the verified model and worker defaults in app/config.py and update README/decisions.",
              "If E2B fails vision or latency, run the wrapper once with -Model gemma4:e4b.", ""]
    (directory / "gate0.md").write_text("\n".join(lines), encoding="utf-8")
    (directory / "environment.md").write_text(
        "# Windows demo environment\n\nCaptured on the target machine; see raw environment.json.\n\n```json\n"
        + json.dumps(one["environment"], indent=2, ensure_ascii=False) + "\n```\n", encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model", nargs="?")
    parser.add_argument("photo", nargs="?", type=Path)
    parser.add_argument("--other-photo", type=Path)
    parser.add_argument("--suite", action="store_true")
    parser.add_argument("--workers", type=int, choices=(1, 4), default=1)
    parser.add_argument("--environment", type=Path)
    parser.add_argument("--structured", action="store_true")
    parser.add_argument("--compare", type=Path, nargs=2, metavar=("ONE", "FOUR"))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report-dir", type=Path)
    args = parser.parse_args(argv)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output = args.output or ROOT / "data" / "gate0" / f"{stamp}.json"
    try:
        if args.compare:
            runs = [json.loads(p.read_text(encoding="utf-8-sig")) for p in args.compare]
            result = compare_runs(*runs)
            write_json(output, result)
            if args.report_dir:
                render_reports(*runs, result, args.report_dir)
            print(json.dumps(result, indent=2))
            return 0 if result["sequential_ok"] else 1
        if not args.model or not args.photo:
            parser.error("model and photo are required")
        if args.model not in ("gemma4:e2b", "gemma4:e4b"):
            parser.error("Gate 0 uses local gemma4:e2b or gemma4:e4b")
        if args.suite:
            if not args.other_photo or not args.environment:
                parser.error("--suite requires --other-photo and --environment")
            environment = json.loads(args.environment.read_text(encoding="utf-8-sig"))
            result = run_suite(args.model, [args.photo, args.other_photo], args.workers, output, environment)
            ok = measurements_ok(result)
            print(f"Technical checks: {'OK; image review required' if ok else 'FAILED'}. Evidence: {output}")
        else:
            result = stream_probe(args.model, sanitize(args.photo.read_bytes()), args.structured)
            result.update(model=args.model, photo=str(args.photo), recorded_at=stamp)
            write_json(output, result)
            print(result["content"])
            print(f"\nfirst content: {result['first_content_s']} s; total: {result['total_s']:.2f} s")
            print(f"Evidence: {output}")
            ok = result["ok"]
            if not ok:
                print(result["error"], file=sys.stderr)
        return 0 if ok else 1
    except (OSError, ValueError) as exc:
        print(f"Gate 0: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
