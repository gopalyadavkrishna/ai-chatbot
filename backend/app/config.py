"""Local configuration loaded from environment variables."""

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

# This loads backend/.env during local development without replacing real
# environment variables set by a deployment platform.
load_dotenv()


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    gemini_embedding_model: str
    database_url: str
    jwt_secret: str
    access_token_expire_minutes: int


@lru_cache
def get_settings() -> Settings:
    """Return the application settings needed for the current phase."""
    supabase_database_url = os.getenv("SUPABASE_DB_URL", "").strip()
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip(),
        gemini_embedding_model=os.getenv(
            "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"
        ).strip(),
        # SUPABASE_DB_URL takes precedence, while DATABASE_URL preserves the
        # existing simple SQLite development setup.
        database_url=supabase_database_url
        or os.getenv("DATABASE_URL", "sqlite:///./customai_studio.db").strip(),
        jwt_secret=os.getenv("JWT_SECRET", "").strip(),
        access_token_expire_minutes=max(
            1, int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        ),
    )
