"""Optional TypeSafe (Jev) text judge. It reads Gemma's short text answer, never a photo.

Only outbound call: the TypeSafe API named by DISCLOSURE_TYPESAFE_URL; unset means off.
Jev returns probabilities and picks, never text. Code maps them to states (app/verify.py).
Every method returns a result with a status and never raises.
"""
import logging
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from .. import config
from .prompts import load_taxonomy

log = logging.getLogger("disclosure.judge")

OK, SKIPPED, UNAVAILABLE = "ok", "skipped", "unavailable"
NONE_OF_THESE = "none_of_these"


@dataclass
class Verdict:
    """Feature 2: three yes-probabilities about one finding (None when not asked)."""
    status: str = SKIPPED
    label_matches: float = None
    severity_plausible: float = None
    has_cost_or_legal: float = None


@dataclass
class EvalVerdict:
    """Feature 1: how well Gemma's text matches the expected answer for a test photo."""
    status: str = SKIPPED
    mentions_expected: float = None
    type_consistent: float = None


@dataclass
class TypeChoice:
    """Feature 3: distribution over defect ids, best first."""
    status: str = SKIPPED
    top: list = field(default_factory=list)  # [(id, probability)], at most three, best first

    @property
    def best(self):
        return self.top[0] if self.top else (NONE_OF_THESE, 0.0)


class Judge(ABC):
    enabled = False

    @abstractmethod
    def verify(self, state: dict) -> Verdict:
        """state: reason, title, defect_type_id/label/look_for, severity, urgency."""

    @abstractmethod
    def evaluate(self, state: dict) -> EvalVerdict:
        """state: model_reason, model_title, model_defect_type, expected_defect_type, expected_details."""

    @abstractmethod
    def classify(self, reason: str, title: str) -> TypeChoice:
        """Pick the defect id that Gemma's description names."""


class NullJudge(Judge):
    """No network. Used when the feature is off and in tests."""

    def verify(self, state):
        return Verdict(SKIPPED)

    def evaluate(self, state):
        return EvalVerdict(SKIPPED)

    def classify(self, reason, title):
        return TypeChoice(SKIPPED)


def _taxonomy_options() -> dict:
    return {d["id"]: d["look_for"] for d in load_taxonomy() if d["id"] != "unclear"}


class TypeSafeJudge(Judge):
    enabled = True

    def __init__(self, client=None, model=None, rng=None):
        self._client = client
        self.model = model or config.TYPESAFE_MODEL
        self.rng = rng or random.Random()

    def _ask(self, state, build_questions):
        """Run one request; return the answers dict, or None on any failure.

        build_questions is called inside the try so an SDK import or question error is a
        judge failure, not a crash.
        """
        try:
            questions = build_questions()
            if self._client is None:
                from typesafe_sdk import RetryPolicy, TypeSafeClient
                self._client = TypeSafeClient(
                    api_key=config.TYPESAFE_API_KEY, base_url=config.TYPESAFE_URL,
                    model=self.model, timeout=config.TYPESAFE_TIMEOUT_S,
                    retry=RetryPolicy(max_retries=1, timeout=config.TYPESAFE_TIMEOUT_S))
            return self._client.system_one(state, questions).answers
        except Exception as exc:  # guardrail: a judge problem must never block a finding
            log.warning("TypeSafe call failed: %s", type(exc).__name__)
            return None

    @staticmethod
    def _noul(answers, key):
        return float(answers[key].noul)

    def verify(self, state):
        def questions():
            from typesafe_sdk import Noul
            return {
            "label_matches": Noul(instructions=(
                "Does the description in `reason` and `title` show the problem named by "
                "`defect_type_label` (things to look for: `defect_type_look_for`)?")),
            "severity_plausible": Noul(instructions=(
                "Is `severity` (1 is trivial, 5 is dangerous or structural) consistent with "
                "what `reason` describes?")),
            "has_cost_or_legal": Noul(instructions=(
                "Does `reason` or `title` state a dollar amount, a legal conclusion, or "
                "liability language?")),
            }
        answers = self._ask(state, questions)
        try:
            return Verdict(OK, self._noul(answers, "label_matches"),
                           self._noul(answers, "severity_plausible"),
                           self._noul(answers, "has_cost_or_legal"))
        except (TypeError, KeyError, AttributeError, ValueError):
            return Verdict(UNAVAILABLE)

    def evaluate(self, state):
        def questions():
            from typesafe_sdk import Noul
            return {
            "mentions_expected": Noul(instructions=(
                "Does `model_reason` or `model_title` describe `expected_details`?")),
            "type_consistent": Noul(instructions=(
                "Does `model_reason` describe damage of the kind named by "
                "`expected_defect_type`?")),
            }
        answers = self._ask(state, questions)
        try:
            return EvalVerdict(OK, self._noul(answers, "mentions_expected"),
                               self._noul(answers, "type_consistent"))
        except (TypeError, KeyError, AttributeError, ValueError):
            return EvalVerdict(UNAVAILABLE)

    def classify(self, reason, title):
        options = list(_taxonomy_options().items())
        self.rng.shuffle(options)  # Jev leans toward the first option; vary it per request
        criteria = dict(options)
        criteria[NONE_OF_THESE] = "The description does not match any other option."

        def questions():
            from typesafe_sdk import Choice
            return {"defect_type": Choice(
                instructions="Which problem does the description in `reason` and `title` name?",
                criteria=criteria)}
        answers = self._ask({"reason": reason, "title": title}, questions)
        try:
            probs = answers["defect_type"].probabilities
            ranked = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)[:3]
            if not ranked or any(k not in criteria for k, _ in ranked):
                return TypeChoice(UNAVAILABLE)
            return TypeChoice(OK, [(k, float(v)) for k, v in ranked])
        except (TypeError, KeyError, AttributeError, ValueError):
            return TypeChoice(UNAVAILABLE)


def build_judge() -> Judge:
    """TypeSafeJudge only when both the URL and a key are set."""
    if config.TYPESAFE_URL and config.TYPESAFE_API_KEY:
        return TypeSafeJudge()
    return NullJudge()
