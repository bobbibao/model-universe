"""The server manifests name the same graphs and auth handler: one composition root, three file formats."""

import json
from pathlib import Path
from typing import Any

from shop_agent import llm

SERVICE_ROOT = Path(__file__).resolve().parents[2]


def manifest(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((SERVICE_ROOT / name).read_text(encoding="utf-8"))
    return data


def graph_paths(name: str) -> dict[str, str]:
    """Graph id -> `path:variable`; langgraph.json wraps each path in an object with a description."""
    graphs = manifest(name)["graphs"]
    return {key: value["path"] if isinstance(value, dict) else value for key, value in graphs.items()}


def test_every_runtime_serves_the_same_graphs_with_the_same_auth() -> None:
    reference = graph_paths("langgraph.json")
    assert set(reference) == {"customer_assistant", "marketing_copy", "improvement", "monitor", "collect", "assistant"}
    for name in ("aegra.json", "aegra.hosted.json"):
        assert graph_paths(name) == reference, name
        assert manifest(name)["auth"] == manifest("langgraph.json")["auth"], name


def test_every_graph_file_exists() -> None:
    for target in graph_paths("langgraph.json").values():
        path, _, variable = target.partition(":")
        assert (SERVICE_ROOT / path).is_file() and variable == "graph", target


def test_the_store_index_matches_the_embeddings_it_names() -> None:
    """aegra.json embeds the Store with the model the Ollama profiles use; the hosted manifest has no index."""
    index = manifest("aegra.json")["store"]["index"]
    provider, model = llm.parse_model_ref(index["embed"])
    local = llm.PROFILES["local"].embeddings
    assert (provider, model, index["dims"]) == (local.provider, local.model, local.dims)
    assert "store" not in manifest("aegra.hosted.json")
