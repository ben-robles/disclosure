import pytest

from app import mailer

PDF = b"%PDF-1.4 test"


def post(client, email="seller@example.org", data=PDF, name="r.pdf"):
    return client.post("/api/email-report", data={"email": email},
                       files={"file": (name, data, "application/pdf")})


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(mailer, "configured", lambda: True)
    monkeypatch.setattr(mailer, "send_report", lambda to, pdf, filename="x": sent.append((to, pdf)))
    return sent


def test_not_configured_is_503(client, monkeypatch):
    monkeypatch.setattr(mailer, "configured", lambda: False)
    assert post(client).status_code == 503


def test_sends_pdf(client, outbox):
    assert post(client).json() == {"ok": True}
    assert outbox == [("seller@example.org", PDF)]


def test_rejects_bad_address_and_non_pdf(client, outbox):
    assert post(client, email="nope").status_code == 422
    assert post(client, data=b"not a pdf").status_code == 422
    assert outbox == []


def test_rate_limit_per_address(client, outbox):
    codes = [post(client).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_send_failure_is_502(client, monkeypatch):
    def boom(*a, **k):
        raise mailer.MailError("SMTPException")
    monkeypatch.setattr(mailer, "configured", lambda: True)
    monkeypatch.setattr(mailer, "send_report", boom)
    assert post(client).status_code == 502
