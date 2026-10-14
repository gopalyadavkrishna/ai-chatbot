"""Tests for selecting and formatting local or Supabase database URLs."""

import pytest

from app.config import get_settings
from app.database import normalise_database_url


@pytest.fixture(autouse=True)
def clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_supabase_url_takes_precedence_over_local_database_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    supabase_url = "postgresql://postgres.project:password@pooler.example:5432/postgres"
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./local.db")
    monkeypatch.setenv("SUPABASE_DB_URL", supabase_url)

    assert get_settings().database_url == supabase_url


def test_postgres_url_uses_psycopg_and_ssl() -> None:
    url = "postgresql://postgres.project:password@pooler.example:5432/postgres"

    assert normalise_database_url(url) == (
        "postgresql+psycopg://postgres.project:password@pooler.example:5432/postgres?sslmode=require"
    )


def test_existing_ssl_query_is_preserved() -> None:
    url = "postgresql+psycopg://postgres:password@db.example:5432/postgres?sslmode=verify-full"

    assert normalise_database_url(url) == url
