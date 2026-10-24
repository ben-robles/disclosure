"""Test double for DefectAnalyzer. Lives in tests/ only: the app ships one real implementation."""
import itertools
import time

from app.inference.analyzer import DefectAnalyzer, Finding

CANNED = [
    Finding("water_intrusion", 3, "30_days", "medium", "ok", "Brown water stain spreading across the ceiling corner."),
    Finding("electrical", 5, "immediate", "high", "ok", "Exposed wires hang from an open junction box."),
    Finding("roof", 2, "1_year", "high", "ok", "A few curling shingles along the roof edge."),
    Finding("unclear", 1, "cosmetic", "low", "blurry", "The photo is too blurry to judge."),
    Finding("unclear", 1, "cosmetic", "low", "not_a_house", "This shows a cat, not part of a home."),
    Finding("unclear", 4, "30_days", "low", "ok", "A crack runs across the wall but the photo is unclear."),
]


class FakeAnalyzer(DefectAnalyzer):
    def __init__(self, findings=None, delay_s=0.0):
        self._cycle = itertools.cycle(findings or CANNED)
        self.delay_s = delay_s
        self.calls = 0

    def analyze(self, image_bytes):
        self.calls += 1
        time.sleep(self.delay_s)
        return Finding(**vars(next(self._cycle)))

    def status(self):
        return {"ready": True, "message": "", "fix": ""}
