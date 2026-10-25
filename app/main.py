"""FastAPI app. Run with: python -m uvicorn app.main:create_app --factory"""
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import classify, config, mailer, present
from .db import Database
from .images import BadImage, sanitize
from .inference.analyzer import DefectAnalyzer
from .inference.judge import Judge, build_judge
from .inference.ollama_analyzer import OllamaAnalyzer
from .inference.prompts import load_taxonomy
from .queue import Worker
from .verify import verify_finding
from .report.pdf import build_pdf

MAX_PHOTOS_PER_SESSION = 30
CSP = ("default-src 'self'; img-src 'self' blob: data:; style-src 'self'; "
       "script-src 'self'; frame-src 'self'; object-src 'self'; base-uri 'none'")


class SessionIn(BaseModel):
    zip: Optional[str] = None


class FindingEdit(BaseModel):
    defect_type: str
    severity: int


class ConfirmIn(BaseModel):
    confirmed: bool = True


def _clean_zip(value):
    if value in (None, ""):
        return None
    if not re.fullmatch(r"\d{5}", value):
        raise HTTPException(422, "ZIP must be 5 digits.")
    return value


def create_app(analyzer: Optional[DefectAnalyzer] = None, data_dir: Optional[Path] = None,
               start_worker: bool = True, judge: Optional[Judge] = None) -> FastAPI:
    data_dir = Path(data_dir or config.DATA_DIR)
    photo_dir, report_dir = data_dir / "photos", data_dir / "reports"
    photo_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    db = Database(data_dir / "disclosure.sqlite3")
    judge = judge or build_judge()
    analyzer = analyzer or OllamaAnalyzer(classify=classify.active(judge))

    def photo_path(pid: str) -> Path:
        return photo_dir / f"{pid}.jpg"

    worker = Worker(db, analyzer, lambda pid: photo_path(pid).read_bytes(),
                    judge=judge)

    @asynccontextmanager
    async def lifespan(_app):
        if start_worker:
            worker.start()
        yield
        if start_worker:
            worker.stop()

    app = FastAPI(title="Disclosure", lifespan=lifespan)
    app.state.db, app.state.worker, app.state.photo_path = db, worker, photo_path

    def need_session(sid):
        s = db.get_session(sid)
        if not s:
            raise HTTPException(404, "Session not found.")
        return s

    def need_photo(pid):
        p = db.get_photo(pid)
        if not p:
            raise HTTPException(404, "Photo not found.")
        return p

    def session_view(sid):
        s = need_session(sid)
        photos = [present.enrich(r) for r in db.session_photos(sid)]
        return {
            "id": sid, "zip": s["zip"], "photos": photos,
            "overall": present.overall(photos),
            "counts": db.counts(sid),
        }

    # ---- meta -------------------------------------------------------------
    @app.get("/api/health")
    def health():
        st = analyzer.status()
        st["model"] = config.MODEL
        st["local"] = config.is_local_url(config.OLLAMA_URL)
        return st

    @app.get("/api/taxonomy")
    def taxonomy():
        return [{"id": d["id"], "label": d["label"]} for d in load_taxonomy()
                if d["id"] != "unclear"]

    # One photo in, one raw finding out, nothing stored. Used by the React UI in
    # frontend/, which keeps its own queue and grading in the browser.
    @app.post("/api/analyze")
    def analyze_one(file: UploadFile = File(...)):
        raw = file.file.read(config.MAX_UPLOAD_BYTES + 1)
        if len(raw) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Photo is too large (15 MB max).")
        try:
            clean = sanitize(raw)
        except BadImage as exc:
            raise HTTPException(400, str(exc))
        finding = analyzer.analyze(clean)
        if config.JUDGE_VERIFY:  # same second opinion the stored-session worker applies
            try:
                finding = verify_finding(judge, finding,
                                         reanalyze=lambda hint: analyzer.analyze(clean, hint=hint))
            except Exception:
                finding.judge_status = "unavailable"
        return vars(finding)

    # ---- sessions ---------------------------------------------------------
    @app.post("/api/session")
    def create_session(body: SessionIn):
        return {"id": db.create_session(_clean_zip(body.zip))}

    @app.get("/api/session/{sid}")
    def get_session(sid: str):
        return session_view(sid)

    @app.patch("/api/session/{sid}")
    def patch_session(sid: str, body: SessionIn):
        need_session(sid)
        db.set_zip(sid, _clean_zip(body.zip))
        return {"ok": True}

    @app.delete("/api/session/{sid}")
    def delete_session(sid: str):
        need_session(sid)
        for pid in db.delete_session(sid):
            photo_path(pid).unlink(missing_ok=True)
        (report_dir / f"{sid}.pdf").unlink(missing_ok=True)
        return {"ok": True}

    @app.get("/api/session/{sid}/status")
    def status(sid: str):
        need_session(sid)
        c = db.counts(sid)
        total = sum(c.values())
        active = c["pending"] + c["processing"]
        return {"total": total, "done": c["done"], "uploaded": c["uploaded"],
                "active": active > 0, "analyzing_total": c["done"] + active}

    # ---- photos -----------------------------------------------------------
    @app.post("/api/session/{sid}/photos")
    async def upload_photo(sid: str, file: UploadFile = File(...)):
        need_session(sid)
        if len(db.session_photos(sid)) >= MAX_PHOTOS_PER_SESSION:
            raise HTTPException(400, "Photo limit reached for this report.")
        raw = await file.read(config.MAX_UPLOAD_BYTES + 1)
        if len(raw) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Photo is too large (15 MB max).")
        try:
            clean = sanitize(raw)
        except BadImage as exc:
            raise HTTPException(400, str(exc))
        pid = db.add_photo(sid)
        photo_path(pid).write_bytes(clean)
        return {"id": pid}

    @app.get("/api/photo/{pid}/image")
    def photo_image(pid: str):
        need_photo(pid)
        return FileResponse(photo_path(pid), media_type="image/jpeg",
                            headers={"Cache-Control": "private, max-age=3600"})

    @app.delete("/api/photo/{pid}")
    def delete_photo(pid: str):
        need_photo(pid)
        db.delete_photo(pid)
        photo_path(pid).unlink(missing_ok=True)
        return {"ok": True}

    @app.post("/api/session/{sid}/analyze")
    def analyze(sid: str):
        need_session(sid)
        return {"queued": db.mark_pending(sid)}

    @app.post("/api/photo/{pid}/retry")
    def retry(pid: str):
        need_photo(pid)
        db.requeue_photo(pid)
        return {"ok": True}

    # ---- findings ---------------------------------------------------------
    def current(pid):
        row = next((r for r in db.session_photos(need_photo(pid)["session_id"])
                    if r["id"] == pid), None)
        if not row or row["defect_type"] is None:
            raise HTTPException(409, "This photo has not been analyzed yet.")
        return present.enrich(row)

    @app.post("/api/photo/{pid}/confirm")
    def confirm(pid: str, body: ConfirmIn):
        f = current(pid)
        if body.confirmed and not f["can_confirm"]:
            raise HTTPException(409, "This photo can't go in the report. Retake or delete it.")
        db.set_confirmed(pid, body.confirmed)
        return current(pid)

    @app.patch("/api/photo/{pid}/finding")
    def edit(pid: str, body: FindingEdit):
        f = current(pid)
        if not f["can_edit"]:
            raise HTTPException(409, "This finding can't be edited. Retake or delete it.")
        if body.defect_type not in {d["id"] for d in load_taxonomy()}:
            raise HTTPException(422, "Unknown defect type.")
        if not 1 <= body.severity <= 5:
            raise HTTPException(422, "Severity must be 1 to 5.")
        db.edit_finding(pid, body.defect_type, body.severity)
        db.set_confirmed(pid, False)  # an edit has to be re-confirmed
        return current(pid)

    # ---- report -----------------------------------------------------------
    @app.post("/api/session/{sid}/report")
    def make_report(sid: str):
        s = need_session(sid)
        photos = [present.enrich(r) for r in db.session_photos(sid)]
        confirmed = [f for f in photos if f.get("confirmed")]
        if not confirmed:
            raise HTTPException(400, "Confirm at least one finding first.")
        pdf = build_pdf(s["zip"], confirmed, present.overall(photos), photo_path)
        (report_dir / f"{sid}.pdf").write_bytes(pdf)
        return {"ok": True, "findings": len(confirmed)}

    @app.get("/api/session/{sid}/report.pdf")
    def get_report(sid: str, download: int = 0):
        need_session(sid)
        path = report_dir / f"{sid}.pdf"
        if not path.exists():
            raise HTTPException(404, "Generate the report first.")
        return FileResponse(path, media_type="application/pdf",
                            filename="disclosure-report.pdf",
                            content_disposition_type="attachment" if download else "inline")

    # ---- email (optional) ------------------------------------------------
    sent_log: dict = {}

    def _allow(key: str, limit: int) -> bool:
        now = time.time()
        recent = [t for t in sent_log.get(key, []) if now - t < 3600]
        sent_log[key] = recent
        if len(recent) >= limit:
            return False
        recent.append(now)
        return True

    @app.post("/api/email-report")
    async def email_report(request: Request, email: str = Form(...), file: UploadFile = File(...)):
        if not mailer.configured():
            raise HTTPException(503, "Email isn't set up on this server.")
        email = email.strip()
        if not mailer.valid_address(email):
            raise HTTPException(422, "Enter a valid email address.")
        pdf = await file.read(config.MAX_UPLOAD_BYTES + 1)
        if len(pdf) > config.MAX_UPLOAD_BYTES or not pdf.startswith(b"%PDF"):
            raise HTTPException(422, "That file isn't a report PDF.")
        client = request.client.host if request.client else "unknown"
        if not (_allow("to:" + email.lower(), 3) and _allow("from:" + client, 10)):
            raise HTTPException(429, "Too many emails. Try again in an hour.")
        try:
            mailer.send_report(email, pdf)
        except mailer.MailError:
            raise HTTPException(502, "We couldn't send the email. Try again, or download the PDF.")
        return {"ok": True}

    # ---- static -----------------------------------------------------------
    @app.get("/")
    def index():
        return FileResponse(config.STATIC_DIR / "index.html",
                            headers={"Content-Security-Policy": CSP, "Cache-Control": "no-cache"})

    app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")
    return app
