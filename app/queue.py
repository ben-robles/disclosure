"""Background workers: DB rows with status 'pending' -> analyzer -> findings.

The database is the queue, so closing the browser (or restarting the server) never loses work.
Several threads pull from it at once; claim_pending hands each photo to exactly one of them.
"""
import threading

from . import config
from .inference.analyzer import unclear_finding


class Worker:
    def __init__(self, db, analyzer, read_image, poll_s=0.5, threads=None):
        self.db, self.analyzer, self.read_image, self.poll_s = db, analyzer, read_image, poll_s
        self.threads = threads or config.WORKERS
        self._stop = threading.Event()
        self._threads = []

    def start(self):
        self.db.reset_processing()
        self._stop.clear()
        self._threads = [
            threading.Thread(target=self._run, name=f"analysis-worker-{i}", daemon=True)
            for i in range(self.threads)
        ]
        for t in self._threads:
            t.start()

    def stop(self):
        self._stop.set()
        for t in self._threads:
            t.join(timeout=5)

    def run_once(self) -> bool:
        pid = self.db.claim_pending()
        if pid is None:
            return False
        try:
            finding = self.analyzer.analyze(self.read_image(pid))
        except Exception:  # guardrail 5: never crash on a bad analysis
            finding = unclear_finding("The model's answer could not be read.", "invalid")
        self.db.save_finding(pid, finding)
        return True

    def _run(self):
        while not self._stop.is_set():
            if not self.run_once():
                self._stop.wait(self.poll_s)
