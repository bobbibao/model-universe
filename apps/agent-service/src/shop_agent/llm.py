"""The only module that knows about model providers (ADR-0010).

Roles (planner, writer, judge, worker) map to `init_chat_model` specs read from `config/llm/<profile>.yaml`, selected
with `LLM_PROFILE` and overridable per role with `LLM_MODEL_<ROLE>=provider:model`. Every profile file is loaded when
this module is imported, so nothing reads a file inside the server's event loop.

Provider keys come from `Settings` (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY), so one `.env` configures the
server, the CLI and the tests alike. The decision model that routes customer turns is `shop_agent.decision`.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml
from langchain.agents.middleware import ModelFallbackMiddleware
from langchain.chat_models import init_chat_model
from langchain.embeddings import init_embeddings
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel, Field, model_validator

from shop_agent.config import Settings, get_settings
from shop_agent.logging import get_logger

logger = get_logger(__name__)

PROFILES_DIR = Path(__file__).resolve().parents[2] / "config" / "llm"
SCRIPTED = "scripted"
EMBEDDING_DIMS = 1024


# provider -> the `Settings` field that holds its key (passed to the client as `api_key`)
PROVIDER_KEY_FIELDS = {"anthropic": "anthropic_api_key", "openai": "openai_api_key", "google_genai": "google_api_key"}


class ModelRole(StrEnum):
    SHOPPER = "shopper"  # the customer assistant: latency and cost first
    PLANNER = "planner"  # investigate, growth planning, copilot
    WRITER = "writer"  # customer-facing copy
    JUDGE = "judge"  # brand rubric, eval judge
    WORKER = "worker"  # subagents, learn, summaries


class ModelSpec(BaseModel):
    provider: str
    model: str
    params: dict[str, Any] = Field(default_factory=dict)
    structured_method: Literal["json_schema", "function_calling"] = "json_schema"
    fallbacks: list[str] = Field(default_factory=list, description="provider:model specs tried in order on failure")


class EmbeddingSpec(BaseModel):
    provider: str
    model: str
    dims: int = EMBEDDING_DIMS
    params: dict[str, Any] = Field(default_factory=dict)


class Profile(BaseModel):
    name: str
    description: str = ""
    roles: dict[ModelRole, ModelSpec]
    embeddings: EmbeddingSpec
    prices_usd_per_mtok: dict[str, tuple[float, float]] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _shopper_defaults_to_planner(cls, data: Any) -> Any:
        """A profile without a `shopper` role serves customers with its planner."""
        if isinstance(data, dict) and isinstance(data.get("roles"), dict):
            roles = data["roles"]
            if ModelRole.SHOPPER.value not in roles and ModelRole.PLANNER.value in roles:
                data = {**data, "roles": {**roles, ModelRole.SHOPPER.value: roles[ModelRole.PLANNER.value]}}
        return data

    def price(self, model: str) -> tuple[float, float]:
        """(input, output) USD per million tokens; 0 for models without a price (local models)."""
        return self.prices_usd_per_mtok.get(model, (0.0, 0.0))


def _load_profiles(directory: Path) -> dict[str, Profile]:
    profiles: dict[str, Profile] = {}
    for path in sorted(directory.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        profiles[path.stem] = Profile(name=path.stem, **data)
    return profiles


PROFILES: dict[str, Profile] = _load_profiles(PROFILES_DIR)


def get_profile(name: str | None = None, settings: Settings | None = None) -> Profile:
    settings = settings or get_settings()
    profile_name = name or settings.llm_profile
    try:
        return PROFILES[profile_name]
    except KeyError as exc:
        known = ", ".join(sorted(PROFILES))
        raise ValueError(f"unknown LLM profile {profile_name!r}; known profiles: {known}") from exc


def parse_model_ref(ref: str) -> tuple[str, str]:
    """Split `provider:model` at the first colon (`ollama:qwen3.5:9b` -> `ollama`, `qwen3.5:9b`)."""
    provider, sep, model = ref.partition(":")
    if not sep or not provider or not model:
        raise ValueError(f"model reference {ref!r} must be provider:model")
    return provider, model


def role_spec(role: ModelRole, profile: Profile, settings: Settings) -> ModelSpec:
    spec = profile.roles[role]
    override: str | None = getattr(settings, f"llm_model_{role.value}")
    if override:
        provider, model = parse_model_ref(override)
        params = spec.params if provider == spec.provider else {}
        spec = ModelSpec(
            provider=provider,
            model=model,
            params=params,
            fallbacks=spec.fallbacks,
            structured_method=spec.structured_method if provider == spec.provider else "json_schema",
        )
    return spec


def _credentials(provider: str, settings: Settings) -> dict[str, Any]:
    """`api_key` for a hosted provider when the settings hold one; otherwise the client reads its own environment."""
    key = getattr(settings, PROVIDER_KEY_FIELDS.get(provider, ""), None)
    return {"api_key": key} if key else {}


def build_chat_model(spec: ModelSpec, settings: Settings) -> BaseChatModel:
    if spec.provider == SCRIPTED:
        from shop_agent.testing.scripted import ScriptedChatModel

        return ScriptedChatModel.from_directories()

    kwargs = {**_credentials(spec.provider, settings), **spec.params}
    if spec.provider == "ollama":
        kwargs.setdefault("base_url", settings.ollama_base_url)
    model = init_chat_model(spec.model, model_provider=spec.provider, **kwargs)
    assert isinstance(model, BaseChatModel)  # noqa: S101 - init_chat_model returns a configurable model only for None
    return model


@lru_cache(maxsize=64)
def _cached_chat_model(profile_name: str, role: ModelRole) -> BaseChatModel:
    settings = get_settings()
    return build_chat_model(role_spec(role, get_profile(profile_name, settings), settings), settings)


def chat_model(role: ModelRole | str, profile: str | None = None) -> BaseChatModel:
    """The chat model for a role in the active (or named) profile."""
    return _cached_chat_model(profile or get_settings().llm_profile, ModelRole(role))


def model_name(role: ModelRole | str, profile: str | None = None) -> str:
    settings = get_settings()
    return role_spec(ModelRole(role), get_profile(profile, settings), settings).model


@lru_cache(maxsize=64)
def _cached_fallback_models(profile_name: str, role: ModelRole) -> tuple[BaseChatModel, ...]:
    settings = get_settings()
    spec = role_spec(role, get_profile(profile_name, settings), settings)
    models = []
    for ref in spec.fallbacks:
        provider, name = parse_model_ref(ref)
        models.append(build_chat_model(ModelSpec(provider=provider, model=name), settings))
    return tuple(models)


def fallback_middleware(role: ModelRole | str, profile: str | None = None) -> ModelFallbackMiddleware | None:
    """`ModelFallbackMiddleware` over the role's fallbacks, or None when the profile lists none."""
    models = _cached_fallback_models(profile or get_settings().llm_profile, ModelRole(role))
    if not models:
        return None
    return ModelFallbackMiddleware(models[0], *models[1:])


def preload(*roles: ModelRole | str) -> None:
    """Build the active profile's models for these roles (and its embeddings) now.

    Graph modules call this at import: the Agent Server imports them before serving, so no model client is built and
    no file is read (scripted answers, certificates) inside its event loop.
    """
    for role in roles:
        chat_model(role)
        fallback_middleware(role)
    embeddings()


StructuredMethod = Literal["json_schema", "function_calling"]


def structured_output_method(role: ModelRole | str, profile: str | None = None) -> StructuredMethod:
    """Use each profile's supported schema transport; scripted responses use function calling."""
    settings = get_settings()
    spec = role_spec(ModelRole(role), get_profile(profile, settings), settings)
    return "function_calling" if spec.provider == SCRIPTED else spec.structured_method


@lru_cache(maxsize=8)
def _cached_embeddings(profile_name: str) -> Embeddings:
    settings = get_settings()
    spec = get_profile(settings.llm_embedding_profile or profile_name, settings).embeddings
    if spec.provider == SCRIPTED:
        from shop_agent.testing.embeddings import HashingEmbedding

        return HashingEmbedding(size=spec.dims)
    kwargs = {**_credentials(spec.provider, settings), **spec.params}
    if spec.provider == "ollama":
        kwargs["base_url"] = settings.ollama_base_url
    return init_embeddings(spec.model, provider=spec.provider, **kwargs)


def embeddings(profile: str | None = None) -> Embeddings:
    return _cached_embeddings(profile or get_settings().llm_profile)


def embedding_spec(profile: str | None = None) -> EmbeddingSpec:
    return get_profile(get_settings().llm_embedding_profile or profile).embeddings


def reset_caches() -> None:
    """Forget built models (tests that change settings)."""
    _cached_chat_model.cache_clear()
    _cached_fallback_models.cache_clear()
    _cached_embeddings.cache_clear()
