import random
from types import SimpleNamespace as NS

import pytest

from app import config
from app.inference.judge import (
    NONE_OF_THESE, OK, SKIPPED, UNAVAILABLE, NullJudge, TypeSafeJudge, build_judge,
)


class FakeClient:
    """Stands in for typesafe_sdk.TypeSafeClient; records the request."""

    def __init__(self, answers=None, error=None):
        self.answers, self.error, self.sent = answers, error, None

    def system_one(self, state, questions):
        self.sent = (state, questions)
        if self.error:
            raise self.error
        return NS(answers=self.answers)


def noul(p):
    return NS(noul=p)


def test_null_judge_never_asks():
    j = NullJudge()
    assert not j.enabled
    assert j.verify({}).status == j.evaluate({}).status == j.classify("a", "b").status == SKIPPED


def test_build_judge_needs_url_and_key(monkeypatch):
    monkeypatch.setattr(config, "TYPESAFE_URL", "")
    monkeypatch.setattr(config, "TYPESAFE_API_KEY", "k")
    assert isinstance(build_judge(), NullJudge)
    monkeypatch.setattr(config, "TYPESAFE_URL", "https://example.test")
    monkeypatch.setattr(config, "TYPESAFE_API_KEY", "")
    assert isinstance(build_judge(), NullJudge)
    monkeypatch.setattr(config, "TYPESAFE_API_KEY", "k")
    assert isinstance(build_judge(), TypeSafeJudge)


def test_verify_reads_three_nouls():
    client = FakeClient({"label_matches": noul(0.8), "severity_plausible": noul(0.2),
                         "has_cost_or_legal": noul(0.05)})
    v = TypeSafeJudge(client).verify({"reason": "r"})
    assert (v.status, v.label_matches, v.severity_plausible, v.has_cost_or_legal) == (OK, 0.8, 0.2, 0.05)
    assert set(client.sent[1]) == {"label_matches", "severity_plausible", "has_cost_or_legal"}


def test_evaluate_reads_two_nouls():
    client = FakeClient({"mentions_expected": noul(0.6), "type_consistent": noul(0.4)})
    e = TypeSafeJudge(client).evaluate({})
    assert (e.status, e.mentions_expected, e.type_consistent) == (OK, 0.6, 0.4)


@pytest.mark.parametrize("error", [RuntimeError("boom"), TimeoutError()])
def test_failure_is_unavailable_not_raised(error):
    j = TypeSafeJudge(FakeClient(error=error))
    assert j.verify({}).status == UNAVAILABLE
    assert j.evaluate({}).status == UNAVAILABLE
    assert j.classify("r", "t").status == UNAVAILABLE


def test_malformed_answer_is_unavailable():
    assert TypeSafeJudge(FakeClient({})).verify({}).status == UNAVAILABLE


def test_classify_ranks_and_shuffles_options():
    probs = {"roof": 0.7, "water_intrusion": 0.2, "electrical": 0.05, NONE_OF_THESE: 0.01, "mold_mildew": 0.04}
    orders = []
    for seed in range(3):
        client = FakeClient({"defect_type": NS(probabilities=probs)})
        c = TypeSafeJudge(client, rng=random.Random(seed)).classify("Missing shingles", "Roof damage")
        orders.append(list(client.sent[1]["defect_type"].criteria))
        assert client.sent[0] == {"reason": "Missing shingles", "title": "Roof damage"}
        assert c.status == OK
        assert [k for k, _ in c.top] == ["roof", "water_intrusion", "electrical"]
    assert len({tuple(o) for o in orders}) > 1  # order differs between requests
    assert "unclear" not in orders[0] and NONE_OF_THESE in orders[0]


def test_classify_rejects_unknown_option():
    client = FakeClient({"defect_type": NS(probabilities={"made_up": 1.0})})
    assert TypeSafeJudge(client).classify("r", "t").status == UNAVAILABLE
