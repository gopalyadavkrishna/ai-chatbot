"""Tests for saved conversation history and user ownership."""

import asyncio
from collections.abc import Generator

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app import conversations as conversations_module
from app.database import Base, get_db
from app.gemini import get_chat_service
from app.main import app
from app.rate_limit import RateLimiter


class FakeConversationService:
    """Captures prompts so no test request reaches Gemini."""

    def __init__(self) -> None:
        self.histories: list[list[tuple[str, str]]] = []
        self.system_instructions: list[str] = []
        self.temperatures: list[float] = []

    def generate_reply(self, message: str) -> str:
        return "Standalone fake reply"

    def generate_reply_with_history(
        self,
        messages: list[tuple[str, str]],
        system_instructions: str,
        temperature: float,
    ) -> str:
        self.histories.append(messages)
        self.system_instructions.append(system_instructions)
        self.temperatures.append(temperature)
        return f"Saved assistant reply {len(self.histories)}"


@pytest.fixture(autouse=True)
def configured_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("JWT_SECRET", "test-secret-that-is-longer-than-thirty-two-characters")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def test_database() -> Generator[None, None, None]:
    """Replace the local SQLite database with one isolated test database."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
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
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
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


def create_chatbot(token: str) -> int:
    response = request(
        "POST",
        "/api/chatbots",
        token=token,
        body={
            "name": "Study Buddy",
            "description": "Helps revise.",
            "system_instructions": "Explain each answer in one short paragraph.",
            "welcome_message": "Ready to study?",
            "temperature": 0.3,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_conversation(token: str, chatbot_id: int) -> int:
    response = request(
        "POST",
        f"/api/chatbots/{chatbot_id}/conversations",
        token=token,
        body={"title": "New conversation"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_messages_are_saved_and_limited_history_is_sent_to_ai(
    test_database: None,
) -> None:
    fake_ai = FakeConversationService()
    app.dependency_overrides[get_chat_service] = lambda: fake_ai
    token = register("history@example.com")
    chatbot_id = create_chatbot(token)
    conversation_id = create_conversation(token, chatbot_id)

    try:
        for number in range(1, 8):
            response = request(
                "POST",
                f"/api/conversations/{conversation_id}/messages",
                token=token,
                body={"message": f"Question {number}"},
            )
            assert response.status_code == 200

        detail = request("GET", f"/api/conversations/{conversation_id}", token=token)
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert detail.status_code == 200
    assert [message["role"] for message in detail.json()["messages"]] == [
        "user",
        "assistant",
    ] * 7
    assert len(fake_ai.histories[-1]) == 12
    assert fake_ai.histories[-1][0] == ("assistant", "Saved assistant reply 1")
    assert fake_ai.histories[-1][-1] == ("user", "Question 7")
    assert fake_ai.system_instructions[-1] == "Explain each answer in one short paragraph."
    assert fake_ai.temperatures[-1] == 0.3


def test_conversation_can_be_renamed_deleted_and_is_private(test_database: None) -> None:
    first_token = register("first-history@example.com")
    second_token = register("second-history@example.com")
    conversation_id = create_conversation(first_token, create_chatbot(first_token))

    renamed = request(
        "PATCH",
        f"/api/conversations/{conversation_id}",
        token=first_token,
        body={"title": "Exam revision"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Exam revision"

    assert request("GET", f"/api/conversations/{conversation_id}", token=second_token).status_code == 404
    assert (
        request(
            "PATCH",
            f"/api/conversations/{conversation_id}",
            token=second_token,
            body={"title": "Stolen title"},
        ).status_code
        == 404
    )
    assert (
        request(
            "DELETE", f"/api/conversations/{conversation_id}", token=second_token
        ).status_code
        == 404
    )

    deleted = request("DELETE", f"/api/conversations/{conversation_id}", token=first_token)
    assert deleted.status_code == 204
    assert request("GET", f"/api/conversations/{conversation_id}", token=first_token).status_code == 404


def test_saved_conversation_messages_are_rate_limited(
    test_database: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_ai = FakeConversationService()
    monkeypatch.setattr(conversations_module, "chat_rate_limiter", RateLimiter(1, 60))
    app.dependency_overrides[get_chat_service] = lambda: fake_ai
    token = register("limited-history@example.com")
    conversation_id = create_conversation(token, create_chatbot(token))

    try:
        first = request(
            "POST",
            f"/api/conversations/{conversation_id}/messages",
            token=token,
            body={"message": "First question"},
        )
        limited = request(
            "POST",
            f"/api/conversations/{conversation_id}/messages",
            token=token,
            body={"message": "Second question"},
        )
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert first.status_code == 200
    assert limited.status_code == 429
    assert limited.headers["retry-after"].isdigit()
