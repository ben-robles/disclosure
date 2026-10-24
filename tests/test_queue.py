import threading
import time

from app.db import Database
from app.queue import Worker
from tests.fake_analyzer import FakeAnalyzer


def pending_photos(db, sid, n):
    ids = [db.add_photo(sid) for _ in range(n)]
    db.mark_pending(sid)
    return ids


def test_each_photo_claimed_once_under_contention(tmp_path):
    db = Database(tmp_path / "q.sqlite3")
    ids = pending_photos(db, db.create_session(), 40)
    claimed, lock = [], threading.Lock()

    def grab():
        while (pid := db.claim_pending()) is not None:
            with lock:
                claimed.append(pid)

    threads = [threading.Thread(target=grab) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(claimed) == sorted(ids)


def test_busy_session_does_not_starve_others(tmp_path):
    db = Database(tmp_path / "q.sqlite3")
    big, small = db.create_session(), db.create_session()
    pending_photos(db, big, 10)
    late = pending_photos(db, small, 1)[0]
    first = db.claim_pending()               # big session's oldest photo is now processing
    assert db.get_photo(first)["status"] == "processing"
    assert db.claim_pending() == late        # small session jumps ahead of big's backlog


class GateAnalyzer(FakeAnalyzer):
    """Blocks until `expected` analyses are running at the same time."""

    def __init__(self, expected):
        super().__init__()
        self.barrier = threading.Barrier(expected, timeout=5)

    def analyze(self, image_bytes):
        self.barrier.wait()
        return super().analyze(image_bytes)


def test_workers_analyze_in_parallel(tmp_path):
    db = Database(tmp_path / "q.sqlite3")
    sid = db.create_session()
    ids = pending_photos(db, sid, 4)
    worker = Worker(db, GateAnalyzer(4), lambda pid: b"", poll_s=0.05, threads=4)
    worker.start()
    try:
        deadline = time.time() + 5
        while db.counts(sid)["done"] < 4 and time.time() < deadline:
            time.sleep(0.05)
    finally:
        worker.stop()
    assert db.counts(sid)["done"] == 4
    # Serial workers would break the barrier, and run_once would store 'invalid' findings.
    assert all(db.get_finding(i)["analysis_status"] == "ok" for i in ids)
