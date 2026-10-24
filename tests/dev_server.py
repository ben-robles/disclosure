"""Run the real app with the canned FakeAnalyzer, for UI checks on a machine without Gemma.

    .venv\\Scripts\\python -m tests.dev_server        (serves on http://127.0.0.1:8001)
"""
import tempfile

import uvicorn

from app.main import create_app
from tests.fake_analyzer import FakeAnalyzer

if __name__ == "__main__":
    app = create_app(analyzer=FakeAnalyzer(delay_s=1.5), data_dir=tempfile.mkdtemp(prefix="disclosure-dev-"))
    uvicorn.run(app, host="127.0.0.1", port=8001)
