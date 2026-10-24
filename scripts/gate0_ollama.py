"""Gate 0 check: does Gemma 4 really see an image through Ollama's HTTP API?

    .venv\\Scripts\\python scripts\\gate0_ollama.py <model-tag> <photo.jpg>

Prints the raw reply and elapsed time. A pass is an image-specific answer in under ~60 s.
The CLI can accept an image without the model seeing it, so this API call is the real test.
"""
import base64
import json
import sys
import time
import urllib.request
from pathlib import Path

URL = "http://127.0.0.1:11434/api/chat"
QUESTION = "Describe the visible defect in one sentence and rate severity 1 to 5."


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    model, photo = sys.argv[1], Path(sys.argv[2])
    payload = {
        "model": model,
        "stream": False,
        "messages": [{
            "role": "user",
            "content": QUESTION,
            "images": [base64.b64encode(photo.read_bytes()).decode("ascii")],
        }],
    }
    req = urllib.request.Request(URL, json.dumps(payload).encode(), {"Content-Type": "application/json"})
    start = time.time()
    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read())
    elapsed = time.time() - start
    print(body["message"]["content"])
    print(f"\nelapsed: {elapsed:.1f} s  (load {body.get('load_duration', 0) / 1e9:.1f} s, "
          f"eval {body.get('eval_duration', 0) / 1e9:.1f} s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
