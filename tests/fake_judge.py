"""Test double for Judge. Lives in tests/ only."""
from app.inference.judge import (
    OK, UNAVAILABLE, EvalVerdict, Judge, TypeChoice, Verdict,
)


class FakeJudge(Judge):
    enabled = True

    def __init__(self, verdict=None, evaluation=None, choice=None, down=False):
        self.verdict = verdict or Verdict(OK, 0.9, 0.9, 0.1)
        self.evaluation = evaluation or EvalVerdict(OK, 0.9, 0.9)
        self.choice = choice or TypeChoice(OK, [("roof", 0.9), ("water_intrusion", 0.05)])
        self.down = down
        self.calls = []

    def verify(self, state):
        self.calls.append(("verify", state))
        return Verdict(UNAVAILABLE) if self.down else self.verdict

    def evaluate(self, state):
        self.calls.append(("evaluate", state))
        return EvalVerdict(UNAVAILABLE) if self.down else self.evaluation

    def classify(self, reason, title):
        self.calls.append(("classify", (reason, title)))
        return TypeChoice(UNAVAILABLE) if self.down else self.choice
