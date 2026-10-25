from app import config


def test_is_local_url_true_for_default_ollama():
    assert config.is_local_url("http://127.0.0.1:11434")
    assert config.is_local_url("http://localhost:11434/")
    assert config.is_local_url("http://LOCALHOST:11434")


def test_is_local_url_false_for_proxy_and_cloud():
    assert not config.is_local_url("http://127.0.0.1:9090")
    assert not config.is_local_url("https://disclosure-gemma-abc-uk.a.run.app")
    assert not config.is_local_url("http://192.168.1.5:11434")


def test_proxy_fix_string():
    assert config.PROXY_FIX == (
        "gcloud run services proxy disclosure-gemma --region us-east4 --port 9090"
    )
