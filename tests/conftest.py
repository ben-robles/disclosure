import io
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402
from tests.fake_analyzer import FakeAnalyzer  # noqa: E402


def make_jpeg(size=(1600, 1200), color=(120, 90, 60), exif=False) -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    if exif:
        e = Image.Exif()
        e[0x010F] = "SecretPhoneMaker"
        e[0x0132] = "2026:01:01 10:00:00"
        img.save(buf, format="JPEG", exif=e)
    else:
        img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def jpeg():
    return make_jpeg


@pytest.fixture
def analyzer():
    return FakeAnalyzer()


@pytest.fixture
def client(tmp_path, analyzer):
    app = create_app(analyzer=analyzer, data_dir=tmp_path, start_worker=False)
    with TestClient(app) as c:
        c.app_ = app
        yield c
