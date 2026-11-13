"""`-m db` tests: a real Postgres with pgvector (scripts/dev/pg-local.sh, or the compose `db` service)."""

from __future__ import annotations

import asyncio
import os
import sys
from collections.abc import Callable

import pytest

if sys.platform == "win32":
    # Psycopg async connections require a selector loop on Windows. The hook must not exist elsewhere: pytest-asyncio
    # rejects a hook that returns no factories.
    def pytest_asyncio_loop_factories() -> dict[str, Callable[[], asyncio.AbstractEventLoop]]:
        return {"psycopg": asyncio.SelectorEventLoop}


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        pytest.fail(f"{name} is not set: start a database with scripts/dev/pg-local.sh")
    return value
