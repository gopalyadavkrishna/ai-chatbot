"""SQLAlchemy setup for local SQLite or a backend-only Supabase database."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    """Base class used by every database model."""


def normalise_database_url(database_url: str) -> str:
    """Make a Supabase Postgres URL explicit for SQLAlchemy's psycopg driver."""
    if database_url.startswith("postgres://"):
        database_url = "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    elif database_url.startswith("postgresql://"):
        database_url = "postgresql+psycopg://" + database_url.removeprefix(
            "postgresql://"
        )

    if database_url.startswith("postgresql+") and "sslmode=" not in database_url:
        separator = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{separator}sslmode=require"
    return database_url


settings = get_settings()
database_url = normalise_database_url(settings.database_url)
is_sqlite = database_url.startswith("sqlite")
engine_options: dict[str, object] = {
    "connect_args": {"check_same_thread": False} if is_sqlite else {},
}
if not is_sqlite:
    # A small pool works well with Supabase's session pooler and checks that a
    # long-idle connection is still valid before every request uses it.
    engine_options.update(pool_pre_ping=True, pool_size=5, max_overflow=5)

engine = create_engine(database_url, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    """Create initial tables in SQLite or a new Supabase Postgres project."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Provide one database session per request and always close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
