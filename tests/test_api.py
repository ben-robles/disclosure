import io

from PIL import Image


def new_session(client, zip_code=None):
    return client.post("/api/session", json={"zip": zip_code}).json()["id"]


def upload(client, sid, jpeg, **kw):
    r = client.post(f"/api/session/{sid}/photos",
                    files={"file": ("p.jpg", jpeg(**kw), "image/jpeg")})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def analyze_all(client, sid):
    client.post(f"/api/session/{sid}/analyze")
    while client.app_.state.worker.run_once():
        pass


def test_health_and_taxonomy(client):
    assert client.get("/api/health").json()["ready"] is True
    ids = [d["id"] for d in client.get("/api/taxonomy").json()]
    assert "roof" in ids and "unclear" not in ids


def test_index_served_with_csp(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "default-src 'self'" in r.headers["content-security-policy"]


def test_zip_validation(client):
    assert client.post("/api/session", json={"zip": "2090"}).status_code == 422
    assert client.post("/api/session", json={"zip": "20901"}).status_code == 200


def test_upload_strips_exif_and_resizes(client, jpeg):
    sid = new_session(client)
    pid = upload(client, sid, jpeg, size=(3000, 2000), exif=True)
    raw = client.get(f"/api/photo/{pid}/image").content
    img = Image.open(io.BytesIO(raw))
    assert max(img.size) == 1024
    assert not img.getexif()
    assert b"SecretPhoneMaker" not in raw


def test_rejects_non_image(client):
    sid = new_session(client)
    r = client.post(f"/api/session/{sid}/photos",
                    files={"file": ("x.jpg", b"not an image", "image/jpeg")})
    assert r.status_code == 400


def test_unknown_session_404(client):
    assert client.get("/api/session/nope").status_code == 404


def test_full_flow_confirm_edit_delete(client, jpeg):
    sid = new_session(client)
    ids = [upload(client, sid, jpeg) for _ in range(3)]
    # nothing analyzed until the user asks
    assert client.get(f"/api/session/{sid}/status").json()["active"] is False
    analyze_all(client, sid)

    photos = client.get(f"/api/session/{sid}").json()["photos"]
    assert [p["defect_type"] for p in photos] == ["water_intrusion", "electrical", "roof"]
    wet, elec, roof = photos
    assert wet["grade"]["text"] == "C–D"          # medium confidence -> range
    assert elec["grade"]["text"] == "F"           # severity 5 x immediate
    assert elec["evaluation"] == "Recommend evaluation by a licensed electrician."
    assert roof["cost"]["text"] == "$300–$1,000"
    assert wet["cost"] and "$" in wet["cost"]["text"]

    # nothing confirmed -> no overall, no report
    assert client.get(f"/api/session/{sid}").json()["overall"] is None
    assert client.post(f"/api/session/{sid}/report").status_code == 400

    client.post(f"/api/photo/{ids[2]}/confirm", json={"confirmed": True})
    assert client.get(f"/api/session/{sid}").json()["overall"] == "B"   # roof 2x2=4 -> B
    client.post(f"/api/photo/{ids[1]}/confirm", json={"confirmed": True})
    assert client.get(f"/api/session/{sid}").json()["overall"] == "F"   # worst wins

    # editing unconfirms and re-grades as user-asserted
    r = client.patch(f"/api/photo/{ids[1]}/finding",
                     json={"defect_type": "plumbing", "severity": 1}).json()
    assert r["confirmed"] is False and r["edited"] is True
    assert r["grade"]["text"] == "B"              # 1 x immediate(4) = 4 -> B, single letter
    assert client.get(f"/api/session/{sid}").json()["overall"] == "B"

    assert client.delete(f"/api/photo/{ids[0]}").status_code == 200
    assert len(client.get(f"/api/session/{sid}").json()["photos"]) == 2


def test_bad_edits_rejected(client, jpeg):
    sid = new_session(client)
    pid = upload(client, sid, jpeg)
    analyze_all(client, sid)
    assert client.patch(f"/api/photo/{pid}/finding",
                        json={"defect_type": "ghosts", "severity": 3}).status_code == 422
    assert client.patch(f"/api/photo/{pid}/finding",
                        json={"defect_type": "roof", "severity": 9}).status_code == 422


def test_guardrail_cards(client, jpeg):
    sid = new_session(client)
    ids = [upload(client, sid, jpeg) for _ in range(6)]
    analyze_all(client, sid)
    p = client.get(f"/api/session/{sid}").json()["photos"]
    blurry, nothouse, lowconf = p[3], p[4], p[5]

    assert blurry["state"] == "blurry" and blurry["grade"] is None
    assert "too blurry" in blurry["message"] and blurry["needs_retake"]
    assert nothouse["state"] == "not_a_house" and "doesn't look like part of a home" in nothouse["message"]
    assert lowconf["state"] == "cant_tell" and lowconf["grade"] is None
    assert lowconf["pro"] == "Licensed home inspector"
    assert "licensed home inspector" in lowconf["message"]

    # blurry / not-a-house can never be confirmed
    assert client.post(f"/api/photo/{ids[3]}/confirm", json={"confirmed": True}).status_code == 409
    assert client.post(f"/api/photo/{ids[4]}/confirm", json={"confirmed": True}).status_code == 409
    # can't-tell may be confirmed (report says: get an inspector)
    assert client.post(f"/api/photo/{ids[5]}/confirm", json={"confirmed": True}).status_code == 200
    assert client.get(f"/api/session/{sid}").json()["overall"] is None


def test_report_pdf(client, jpeg):
    sid = new_session(client, "20901")
    ids = [upload(client, sid, jpeg) for _ in range(3)]
    analyze_all(client, sid)
    for pid in ids:
        client.post(f"/api/photo/{pid}/confirm", json={"confirmed": True})
    assert client.get(f"/api/session/{sid}/report.pdf").status_code == 404
    assert client.post(f"/api/session/{sid}/report").json()["findings"] == 3
    r = client.get(f"/api/session/{sid}/report.pdf")
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["content-disposition"].startswith("inline")
    assert r.content.startswith(b"%PDF")
    d = client.get(f"/api/session/{sid}/report.pdf?download=1")
    assert d.headers["content-disposition"].startswith("attachment")


def test_delete_session_wipes_everything(client, jpeg, tmp_path):
    sid = new_session(client)
    pid = upload(client, sid, jpeg)
    analyze_all(client, sid)
    client.post(f"/api/photo/{pid}/confirm", json={"confirmed": True})
    client.post(f"/api/session/{sid}/report")
    assert (tmp_path / "photos" / f"{pid}.jpg").exists()
    assert client.delete(f"/api/session/{sid}").status_code == 200
    assert not (tmp_path / "photos" / f"{pid}.jpg").exists()
    assert not (tmp_path / "reports" / f"{sid}.pdf").exists()
    assert client.get(f"/api/session/{sid}").status_code == 404


def test_retry_requeues(client, jpeg):
    from app.inference.analyzer import unclear_finding
    from tests.fake_analyzer import FakeAnalyzer
    client.app_.state.worker.analyzer = FakeAnalyzer([unclear_finding("Analysis timed out.", "timeout")])
    sid = new_session(client)
    pid = upload(client, sid, jpeg)
    analyze_all(client, sid)
    card = client.get(f"/api/session/{sid}").json()["photos"][0]
    assert card["state"] == "timeout" and card["needs_retry"]
    client.app_.state.worker.analyzer = FakeAnalyzer()
    client.post(f"/api/photo/{pid}/retry")
    while client.app_.state.worker.run_once():
        pass
    assert client.get(f"/api/session/{sid}").json()["photos"][0]["state"] == "graded"


def test_analyze_one_returns_finding_and_stores_nothing(client, jpeg, analyzer):
    r = client.post("/api/analyze", files={"file": ("p.jpg", jpeg(), "image/jpeg")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["defect_type"] == "water_intrusion"
    assert set(body) >= {"severity", "urgency", "confidence", "image_quality", "reason", "analysis_status"}
    assert analyzer.calls == 1
    assert not list((client.app_.state.photo_path("x").parent).iterdir())


def test_analyze_one_rejects_non_image(client):
    r = client.post("/api/analyze", files={"file": ("x.jpg", b"not an image", "image/jpeg")})
    assert r.status_code == 400


def test_label_uses_model_title_when_category_does_not_fit(tmp_path):
    from app import present
    from app.inference.analyzer import Finding
    from app.db import Database
    db = Database(tmp_path / "t.sqlite3")
    sid = db.create_session()
    pid = db.add_photo(sid)
    db.save_finding(pid, Finding("water_intrusion", 4, "immediate", "high", "ok",
                                 "A large tree branch rests on the roof.",
                                 title="Fallen tree on roof", category_fits=False))
    row = db.session_photos(sid)[0]
    assert present.enrich(row)["label"] == "Fallen tree on roof"
    db.edit_finding(pid, "roof", 4)  # a hand-picked category shows its own label again
    assert present.enrich(db.session_photos(sid)[0])["label"] == "Roof damage"


def test_label_falls_back_when_misfit_has_no_title(tmp_path):
    from app import present
    from app.inference.analyzer import Finding
    from app.db import Database
    db = Database(tmp_path / "t.sqlite3")
    sid = db.create_session()
    pid = db.add_photo(sid)
    db.save_finding(pid, Finding("water_intrusion", 4, "immediate", "high", "ok", "x", category_fits=False))
    assert present.enrich(db.session_photos(sid)[0])["label"] == "Other issue"


def test_fitting_category_keeps_its_label(tmp_path):
    from app import present
    from app.inference.analyzer import Finding
    from app.db import Database
    db = Database(tmp_path / "t.sqlite3")
    sid = db.create_session()
    pid = db.add_photo(sid)
    db.save_finding(pid, Finding("roof", 2, "1_year", "high", "ok", "x", title="Curling shingles"))
    assert present.enrich(db.session_photos(sid)[0])["label"] == "Roof damage"


def test_old_database_gets_new_columns(tmp_path):
    import sqlite3
    path = tmp_path / "old.sqlite3"
    c = sqlite3.connect(path)
    c.executescript("CREATE TABLE findings (photo_id TEXT PRIMARY KEY, defect_type TEXT NOT NULL,"
                    " severity INTEGER NOT NULL, urgency TEXT NOT NULL, confidence TEXT NOT NULL,"
                    " image_quality TEXT NOT NULL, reason TEXT NOT NULL,"
                    " analysis_status TEXT NOT NULL DEFAULT 'ok',"
                    " confirmed INTEGER NOT NULL DEFAULT 0, edited INTEGER NOT NULL DEFAULT 0);")
    c.commit(); c.close()
    from app.db import Database
    Database(path)
    cols = {r[1] for r in sqlite3.connect(path).execute("PRAGMA table_info(findings)")}
    assert {"title", "category_fits"} <= cols
