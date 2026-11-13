"""The decision model client: typed questions in, calibrated answers out, None on any failure.

A decision model (a "System 1" model: Gemini Decision, TypeSafe Jev) answers typed questions about a piece of state: a
choice among named options, or a yes/no probability. It writes no text, so a call costs a fraction of a chat model's
price and latency. Callers use it to route work and must treat None (no key, timeout, error) as "unknown" and fall back
to their slower path.

The providers differ only in endpoint, credential header and request shape; each one is a `Backend` in `BACKENDS`. The
answers share one shape (`DecisionAnswer`). Adding a provider is one entry there and its key in `Settings`.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field, ValidationError

from shop_agent.config import DecisionProvider, Settings, get_settings
from shop_agent.logging import get_logger

logger = get_logger(__name__)

State = str | Mapping[str, Any]


class Choice(BaseModel):
    """Pick one named option; `criteria` maps each option to a description (or None)."""

    type: Literal["choice"] = "choice"
    instructions: str
    criteria: dict[str, str | None]


class YesNo(BaseModel):
    """The probability that the answer is yes (the providers' `noul` question type)."""

    type: Literal["noul"] = "noul"
    instructions: str
    criteria: str | None = None


Question = Choice | YesNo


class DecisionAnswer(BaseModel):
    choice: str | None = None
    probabilities: dict[str, float] = Field(default_factory=dict)
    confidence: float | None = None
    noul: float | None = None


# --- Request shapes -------------------------------------------------------------------------------------------------


def _bearer(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def _google_key(key: str) -> dict[str, str]:
    return {"x-goog-api-key": key}


def _typesafe_question(question: Question) -> dict[str, Any]:
    return question.model_dump(exclude_none=True)


def _openrouter_question(question: Question) -> dict[str, Any]:
    """OpenRouter requires text for every option and true/false criteria for a yes/no question."""
    body = question.model_dump(exclude_none=True)
    if isinstance(question, Choice):
        body["criteria"] = {option: text or option for option, text in question.criteria.items()}
    elif question.criteria:
        body["criteria"] = {"true": question.criteria, "false": f"Not the case: {question.criteria}"}
    return body


def _google_question(question: Question) -> dict[str, Any]:
    """Gemini describes every option with a string (empty is allowed) and a yes/no with `true_description`."""
    body = question.model_dump(exclude_none=True)
    if isinstance(question, Choice):
        body["criteria"] = {option: text or "" for option, text in question.criteria.items()}
    elif question.criteria:
        body["criteria"] = {"true_description": question.criteria}
    return body


def _as_given(state: State) -> Any:
    return state


def _as_text(state: State) -> str:
    return state if isinstance(state, str) else json.dumps(state, ensure_ascii=False)


@dataclass(frozen=True)
class Backend:
    """How one provider is called. `state` is the request field that carries the shared context."""

    base_url: str
    path: str
    model: str
    headers: Callable[[str], dict[str, str]]
    question: Callable[[Question], dict[str, Any]]
    state_field: str = "state"
    state: Callable[[State], Any] = _as_given

    def body(self, model: str, state: State, questions: Mapping[str, Question]) -> dict[str, Any]:
        return {
            "model": model,
            self.state_field: self.state(state),
            "questions": {key: self.question(question) for key, question in questions.items()},
        }


BACKENDS: dict[DecisionProvider, Backend] = {
    # Gemini Decisions API (beta): `input` is text, billed on input tokens only.
    "google": Backend(
        base_url="https://generativelanguage.googleapis.com/v1beta",
        path="/decisions",
        model="gemini-decision-1",
        headers=_google_key,
        question=_google_question,
        state_field="input",
        state=_as_text,
    ),
    # TypeSafe Jev through OpenRouter's Decisions API.
    "openrouter": Backend(
        base_url="https://openrouter.ai/api/alpha",
        path="/decisions",
        model="~typesafe/jev-latest",
        headers=_bearer,
        question=_openrouter_question,
    ),
    # TypeSafe Jev directly.
    "typesafe": Backend(
        base_url="https://api.typesafe.ai/v1",
        path="/systemone",
        model="jev-latest",
        headers=_bearer,
        question=_typesafe_question,
    ),
}


# --- Configuration --------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Route:
    """The provider in force: its backend with the settings' overrides applied, and its key."""

    provider: DecisionProvider
    backend: Backend
    base_url: str
    model: str
    api_key: str


def provider_for(settings: Settings) -> DecisionProvider:
    """DECISION_PROVIDER, or the provider that shares the chat profile's key (google profiles: Gemini Decision)."""
    if settings.decision_provider:
        return settings.decision_provider
    return "google" if settings.llm_profile.startswith("google") else "openrouter"


def api_key_for(provider: DecisionProvider, settings: Settings) -> str | None:
    """The provider's key. The OpenAI key is reused for OpenRouter only when the chat profile is an OpenRouter one."""
    if provider == "google":
        return settings.google_api_key
    if provider == "typesafe":
        return settings.typesafe_api_key
    if settings.openrouter_api_key:
        return settings.openrouter_api_key
    return settings.openai_api_key if settings.llm_profile.startswith("openrouter") else None


def resolve(settings: Settings | None = None) -> Route | None:
    """The decision route for these settings; None when the provider has no key (routing is off)."""
    settings = settings or get_settings()
    provider = provider_for(settings)
    api_key = api_key_for(provider, settings)
    if not api_key:
        return None
    backend = BACKENDS[provider]
    return Route(
        provider=provider,
        backend=backend,
        base_url=settings.decision_base_url or backend.base_url,
        model=settings.decision_model or backend.model,
        api_key=api_key,
    )


# --- Client ---------------------------------------------------------------------------------------------------------

_client: httpx.AsyncClient | None = None


def _http(route: Route, settings: Settings) -> httpx.AsyncClient:
    """One pooled client per process: connection reuse saves a TLS handshake on every routed turn."""
    global _client  # a process-wide connection pool
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=route.base_url,
            timeout=settings.decision_timeout_seconds,
            limits=httpx.Limits(max_connections=32, max_keepalive_connections=16),
        )
    return _client


async def decide(
    state: State, questions: Mapping[str, Question], *, settings: Settings | None = None
) -> dict[str, DecisionAnswer] | None:
    """Answer typed questions about `state` with the decision model; None when it is not configured or fails."""
    settings = settings or get_settings()
    route = resolve(settings)
    if route is None:
        return None
    body = route.backend.body(route.model, state, questions)
    try:
        response = await _http(route, settings).post(
            route.backend.path, json=body, headers=route.backend.headers(route.api_key)
        )
        response.raise_for_status()
        answers = response.json().get("answers") or {}
        return {key: DecisionAnswer.model_validate(answers[key]) for key in questions if key in answers}
    except (httpx.HTTPError, ValueError, ValidationError) as exc:
        # Routing is an optimisation: the caller falls back to its slower path. The key never reaches the log.
        logger.warning("decision model unavailable", provider=route.provider, error=type(exc).__name__)
        return None
