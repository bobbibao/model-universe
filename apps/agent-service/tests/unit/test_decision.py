"""The decision model client (shop_agent.decision): typed questions out, calibrated answers in, None on any failure."""

import json
from collections.abc import Callable, Iterator, Mapping

import httpx
import pytest

from shop_agent import decision
from shop_agent.config import Settings, get_settings

QUESTIONS = {"intent": decision.Choice(instructions="Which?", criteria={"search": "Find kits", "other": None})}
ANSWER = {"type": "choice", "choice": "search", "confidence": 0.9, "probabilities": {"search": 0.93, "other": 0.07}}


def settings(**values: object) -> Settings:
    return Settings(_env_file=None, **values)  # type: ignore[arg-type]


@pytest.fixture(autouse=True)
def _no_pooled_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    yield
    monkeypatch.setattr(decision, "_client", None)
    get_settings.cache_clear()


def _serve(
    monkeypatch: pytest.MonkeyPatch, config: Settings, handler: Callable[[httpx.Request], httpx.Response]
) -> None:
    """Run `decide` with these settings against a mock transport at the provider's real base URL."""
    monkeypatch.setattr(decision, "get_settings", lambda: config)
    monkeypatch.setattr(
        decision,
        "_http",
        lambda route, _settings: httpx.AsyncClient(base_url=route.base_url, transport=httpx.MockTransport(handler)),
    )


def _recorder(seen: dict[str, object], reply: Mapping[str, object]) -> Callable[[httpx.Request], httpx.Response]:
    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["headers"] = request.headers
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=reply)

    return handler


async def test_typesafe_sends_typed_questions_and_parses_answers(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, object] = {}
    reply = {"answers": {"intent": ANSWER}, "model": "jev-1.13.0"}
    _serve(monkeypatch, settings(decision_provider="typesafe", typesafe_api_key="test-key"), _recorder(seen, reply))
    answers = await decision.decide({"message": "kits under 1 million"}, QUESTIONS)
    assert answers is not None
    assert answers["intent"].choice == "search" and answers["intent"].confidence == 0.9
    assert seen["url"] == "https://api.typesafe.ai/v1/systemone"
    assert seen["headers"]["authorization"] == "Bearer test-key"  # type: ignore[index]
    assert seen["body"] == {
        "model": "jev-latest",
        "state": {"message": "kits under 1 million"},
        "questions": {
            "intent": {"type": "choice", "instructions": "Which?", "criteria": {"search": "Find kits", "other": None}}
        },
    }


async def test_openrouter_uses_the_decisions_api(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, object] = {}
    reply = {"model": "typesafe/jev-1.14", "answers": {"intent": ANSWER}, "usage": {"input_tokens": 40}}
    _serve(monkeypatch, settings(decision_provider="openrouter", openrouter_api_key="or-key"), _recorder(seen, reply))
    answers = await decision.decide("kits under 1 million", QUESTIONS)
    assert answers is not None and answers["intent"].choice == "search"
    assert seen["url"] == "https://openrouter.ai/api/alpha/decisions"
    assert seen["headers"]["authorization"] == "Bearer or-key"  # type: ignore[index]
    body = seen["body"]
    assert isinstance(body, dict)
    assert body["model"] == "~typesafe/jev-latest"
    # OpenRouter requires guidance text for every option and true/false criteria for yes/no questions.
    assert body["questions"]["intent"]["criteria"] == {"search": "Find kits", "other": "other"}


async def test_google_uses_the_gemini_decisions_api(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, object] = {}
    reply = {"answers": {"intent": ANSWER}, "usage": {"total_input_tokens": 52, "total_output_tokens": 0}}
    _serve(monkeypatch, settings(llm_profile="google", google_api_key="g-key"), _recorder(seen, reply))
    answers = await decision.decide({"message": "kit dưới 1 triệu", "recentHistory": []}, QUESTIONS)
    assert answers is not None
    assert answers["intent"].choice == "search" and answers["intent"].probabilities["search"] == 0.93
    assert seen["url"] == "https://generativelanguage.googleapis.com/v1beta/decisions"
    headers = seen["headers"]
    assert headers["x-goog-api-key"] == "g-key" and "authorization" not in headers  # type: ignore[index, operator]
    assert seen["body"] == {
        "model": "gemini-decision-1",
        # Gemini takes the shared context as text; Vietnamese stays readable (fewer tokens than \\u escapes).
        "input": '{"message": "kit dưới 1 triệu", "recentHistory": []}',
        "questions": {
            "intent": {"type": "choice", "instructions": "Which?", "criteria": {"search": "Find kits", "other": ""}}
        },
    }


def test_yes_no_criteria_per_provider() -> None:
    question = decision.YesNo(instructions="Is it urgent?", criteria="The customer needs it today")
    assert decision.BACKENDS["openrouter"].question(question)["criteria"] == {
        "true": "The customer needs it today",
        "false": "Not the case: The customer needs it today",
    }
    assert decision.BACKENDS["google"].question(question)["criteria"] == {
        "true_description": "The customer needs it today"
    }
    assert decision.BACKENDS["typesafe"].question(question)["criteria"] == "The customer needs it today"
    bare = decision.YesNo(instructions="Is it urgent?")
    assert all("criteria" not in backend.question(bare) for backend in decision.BACKENDS.values())


@pytest.mark.parametrize("status", [400, 401, 402, 429, 500])
async def test_decide_falls_back_to_none_on_errors(monkeypatch: pytest.MonkeyPatch, status: int) -> None:
    config = settings(decision_provider="google", google_api_key="g-key")
    _serve(monkeypatch, config, lambda request: httpx.Response(status, json={"error": {"message": "no"}}))
    assert await decision.decide("state", QUESTIONS) is None


async def test_decide_falls_back_to_none_on_a_timeout_or_a_malformed_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    config = settings(decision_provider="google", google_api_key="g-key")

    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    _serve(monkeypatch, config, timeout)
    assert await decision.decide("state", QUESTIONS) is None
    _serve(monkeypatch, config, lambda request: httpx.Response(200, json={"answers": {"intent": {"choice": 7}}}))
    assert await decision.decide("state", QUESTIONS) is None


async def test_decide_is_off_without_a_key(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request without a key")

    for config in (
        settings(decision_provider="typesafe"),
        settings(decision_provider="google"),
        settings(llm_profile="google"),
        settings(llm_profile="openai", openai_api_key="sk-openai"),
    ):
        _serve(monkeypatch, config, fail)
        assert decision.resolve(config) is None
        assert await decision.decide("state", QUESTIONS) is None


def test_the_provider_follows_the_chat_profile_unless_it_is_set() -> None:
    assert decision.provider_for(settings(llm_profile="google")) == "google"
    assert decision.provider_for(settings(llm_profile="anthropic")) == "openrouter"
    assert decision.provider_for(settings(llm_profile="google", decision_provider="typesafe")) == "typesafe"


def test_openrouter_reuses_the_openai_key_only_for_openrouter_profiles() -> None:
    reused = decision.resolve(settings(llm_profile="openrouter-fast", openai_api_key="sk-or"))
    assert reused is not None and reused.provider == "openrouter" and reused.api_key == "sk-or"
    assert decision.resolve(settings(llm_profile="openai", openai_api_key="sk-openai")) is None
    explicit = decision.resolve(settings(llm_profile="openai", openai_api_key="sk-openai", openrouter_api_key="or"))
    assert explicit is not None and explicit.api_key == "or"


def test_model_and_base_url_overrides() -> None:
    route = decision.resolve(
        settings(
            decision_provider="google",
            google_api_key="g-key",
            decision_model="gemini-decision-2",
            decision_base_url="https://proxy.test/v1",
        )
    )
    assert route is not None
    assert (route.model, route.base_url, route.backend.path) == (
        "gemini-decision-2",
        "https://proxy.test/v1",
        "/decisions",
    )


async def test_the_key_is_never_logged(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, capfd: pytest.CaptureFixture[str]
) -> None:
    config = settings(decision_provider="google", google_api_key="super-secret-key")
    _serve(monkeypatch, config, lambda request: httpx.Response(401, json={}))
    with caplog.at_level("DEBUG"):
        assert await decision.decide("state", QUESTIONS) is None
    captured = capfd.readouterr()
    assert "super-secret-key" not in caplog.text + captured.out + captured.err
