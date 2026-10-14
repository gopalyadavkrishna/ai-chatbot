"""Integration tests for account and chatbot ownership behaviour."""

import asyncio
from collections.abc import Generator

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.models import User


@pytest.fixture(autouse=True)
def configured_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    """Ensure tests sign tokens with a private, deterministic test secret."""
    monkeypatch.setenv("JWT_SECRET", "test-secret-that-is-longer-than-thirty-two-characters")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def test_database() -> Generator[sessionmaker[Session], None, None]:
    """Replace the local SQLite file with an isolated in-memory test database."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    test_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield test_session
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


async def send_request(
    method: str,
    path: str,
    *,
    body: dict[str, object] | None = None,
    token: str | None = None,
) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.request(method, path, json=body, headers=headers)


def request(
    method: str,
    path: str,
    *,
    body: dict[str, object] | None = None,
    token: str | None = None,
) -> httpx.Response:
    return asyncio.run(send_request(method, path, body=body, token=token))


def register(email: str) -> str:
    response = request(
        "POST",
        "/api/auth/register",
        body={"email": email, "password": "correct-horse-battery-staple"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def chatbot_payload(name: str = "Study Buddy") -> dict[str, object]:
    return {
        "name": name,
        "description": "Helps with revision.",
        "system_instructions": "Explain ideas simply.",
        "welcome_message": "What would you like to study?",
        "temperature": 0.4,
    }


def test_registration_hashes_password_then_login_and_logout_work(
    test_database: sessionmaker[Session],
) -> None:
    token = register("student@example.com")

    with test_database() as db:
        user = db.scalar(select(User).where(User.email == "student@example.com"))
        assert user is not None
        assert user.password_hash != "correct-horse-battery-staple"

    login = request(
        "POST",
        "/api/auth/login",
        body={"email": "student@example.com", "password": "correct-horse-battery-staple"},
    )
    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"

    logout = request("POST", "/api/auth/logout", token=token)
    assert logout.status_code == 204

    after_logout = request("GET", "/api/chatbots", token=token)
    assert after_logout.status_code == 401


def test_users_cannot_access_each_others_chatbots(
    test_database: sessionmaker[Session],
) -> None:
    first_user_token = register("first@example.com")
    second_user_token = register("second@example.com")

    created = request(
        "POST", "/api/chatbots", body=chatbot_payload(), token=first_user_token
    )
    assert created.status_code == 201
    chatbot_id = created.json()["id"]

    second_user_list = request("GET", "/api/chatbots", token=second_user_token)
    assert second_user_list.status_code == 200
    assert second_user_list.json() == []

    assert (
        request("GET", f"/api/chatbots/{chatbot_id}", token=second_user_token).status_code
        == 404
    )
    assert (
        request(
            "PUT",
            f"/api/chatbots/{chatbot_id}",
            body=chatbot_payload("Changed by another user"),
            token=second_user_token,
        ).status_code
        == 404
    )
    assert (
        request(
            "DELETE", f"/api/chatbots/{chatbot_id}", token=second_user_token
        ).status_code
        == 404
    )


def test_owner_can_create_update_and_delete_a_chatbot(
    test_database: sessionmaker[Session],
) -> None:
    token = register("owner@example.com")
    created = request("POST", "/api/chatbots", body=chatbot_payload(), token=token)
    chatbot_id = created.json()["id"]

    updated = request(
        "PUT",
        f"/api/chatbots/{chatbot_id}",
        body=chatbot_payload("Exam Coach"),
        token=token,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Exam Coach"

    deleted = request("DELETE", f"/api/chatbots/{chatbot_id}", token=token)
    assert deleted.status_code == 204
    assert request("GET", "/api/chatbots", token=token).json() == []
