"""sqlite3 storage. One short-lived connection per call; safe across threads."""
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, zip TEXT, created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS findings (
  photo_id TEXT PRIMARY KEY REFERENCES photos(id),
  defect_type TEXT NOT NULL, severity INTEGER NOT NULL, urgency TEXT NOT NULL,
  confidence TEXT NOT NULL, image_quality TEXT NOT NULL, reason TEXT NOT NULL,
  analysis_status TEXT NOT NULL DEFAULT 'ok',
  confirmed INTEGER NOT NULL DEFAULT 0, edited INTEGER NOT NULL DEFAULT 0
);
"""
# photos.status: uploaded | pending | processing | done


class Database:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.conn() as c:
            c.execute("PRAGMA journal_mode=WAL")  # readers don't block the workers' writes
            c.executescript(SCHEMA)

    @contextmanager
    def conn(self):
        c = sqlite3.connect(self.path, timeout=10)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()

    # sessions
    def create_session(self, zip_code=None) -> str:
        sid = uuid.uuid4().hex
        with self.conn() as c:
            c.execute("INSERT INTO sessions(id, zip, created_at) VALUES(?,?,?)",
                      (sid, zip_code, time.time()))
        return sid

    def get_session(self, sid):
        with self.conn() as c:
            row = c.execute("SELECT * FROM sessions WHERE id=?", (sid,)).fetchone()
        return dict(row) if row else None

    def set_zip(self, sid, zip_code):
        with self.conn() as c:
            c.execute("UPDATE sessions SET zip=? WHERE id=?", (zip_code, sid))

    def delete_session(self, sid) -> list:
        """Remove all rows for a session; return its photo ids so files can be wiped."""
        with self.conn() as c:
            ids = [r["id"] for r in c.execute("SELECT id FROM photos WHERE session_id=?", (sid,))]
            c.executemany("DELETE FROM findings WHERE photo_id=?", [(i,) for i in ids])
            c.execute("DELETE FROM photos WHERE session_id=?", (sid,))
            c.execute("DELETE FROM sessions WHERE id=?", (sid,))
        return ids

    # photos
    def add_photo(self, sid) -> str:
        pid = uuid.uuid4().hex
        with self.conn() as c:
            c.execute("INSERT INTO photos(id, session_id, created_at) VALUES(?,?,?)",
                      (pid, sid, time.time()))
        return pid

    def get_photo(self, pid):
        with self.conn() as c:
            row = c.execute("SELECT * FROM photos WHERE id=?", (pid,)).fetchone()
        return dict(row) if row else None

    def get_finding(self, pid):
        with self.conn() as c:
            row = c.execute("SELECT * FROM findings WHERE photo_id=?", (pid,)).fetchone()
        return dict(row) if row else None

    def delete_photo(self, pid):
        with self.conn() as c:
            c.execute("DELETE FROM findings WHERE photo_id=?", (pid,))
            c.execute("DELETE FROM photos WHERE id=?", (pid,))

    def session_photos(self, sid) -> list:
        """Photos joined with their finding columns (NULL until analyzed)."""
        with self.conn() as c:
            rows = c.execute(
                "SELECT p.id, p.status, p.created_at, f.defect_type, f.severity, f.urgency,"
                " f.confidence, f.image_quality, f.reason, f.analysis_status,"
                " f.confirmed, f.edited"
                " FROM photos p LEFT JOIN findings f ON f.photo_id = p.id"
                " WHERE p.session_id=? ORDER BY p.created_at, p.rowid", (sid,)).fetchall()
        return [dict(r) for r in rows]

    def mark_pending(self, sid) -> int:
        with self.conn() as c:
            cur = c.execute(
                "UPDATE photos SET status='pending' WHERE session_id=? AND status='uploaded'",
                (sid,))
            return cur.rowcount

    def requeue_photo(self, pid):
        with self.conn() as c:
            c.execute("DELETE FROM findings WHERE photo_id=?", (pid,))
            c.execute("UPDATE photos SET status='pending' WHERE id=?", (pid,))

    def reset_processing(self):
        """After a crash or restart, anything mid-analysis goes back in the queue."""
        with self.conn() as c:
            c.execute("UPDATE photos SET status='pending' WHERE status='processing'")

    def claim_pending(self):
        """Atomically take the next pending photo id, or None.

        One statement, so two workers can never claim the same photo. Sessions with the
        fewest photos already processing go first: one big upload can't starve other users.
        """
        with self.conn() as c:
            row = c.execute(
                "UPDATE photos SET status='processing' WHERE status='pending' AND id = ("
                " SELECT p.id FROM photos p WHERE p.status='pending'"
                " ORDER BY (SELECT COUNT(*) FROM photos q"
                "           WHERE q.session_id = p.session_id AND q.status='processing'),"
                "          p.created_at, p.rowid LIMIT 1)"
                " RETURNING id").fetchone()
        return row["id"] if row else None

    def save_finding(self, pid, f) -> bool:
        """Store the model's finding and mark the photo done (skipped if photo was deleted)."""
        with self.conn() as c:
            if not c.execute("SELECT 1 FROM photos WHERE id=?", (pid,)).fetchone():
                return False
            c.execute(
                "INSERT OR REPLACE INTO findings(photo_id, defect_type, severity, urgency,"
                " confidence, image_quality, reason, analysis_status, confirmed, edited)"
                " VALUES(?,?,?,?,?,?,?,?,0,0)",
                (pid, f.defect_type, f.severity, f.urgency, f.confidence,
                 f.image_quality, f.reason, f.analysis_status))
            c.execute("UPDATE photos SET status='done' WHERE id=?", (pid,))
        return True

    # findings
    def set_confirmed(self, pid, confirmed: bool):
        with self.conn() as c:
            c.execute("UPDATE findings SET confirmed=? WHERE photo_id=?", (int(confirmed), pid))

    def edit_finding(self, pid, defect_type, severity):
        with self.conn() as c:
            c.execute("UPDATE findings SET defect_type=?, severity=?, edited=1 WHERE photo_id=?",
                      (defect_type, severity, pid))

    def counts(self, sid) -> dict:
        out = {"uploaded": 0, "pending": 0, "processing": 0, "done": 0}
        with self.conn() as c:
            for r in c.execute(
                    "SELECT status, COUNT(*) n FROM photos WHERE session_id=? GROUP BY status",
                    (sid,)):
                out[r["status"]] = r["n"]
        return out
