"""Tests for the chat endpoint using a fake AI service."""

import asyncio

import httpx
import pytest

from app import main as main_module
from app.gemini import AIServiceError, get_chat_service
from app.main import app
from app.rate_limit import RateLimiter


class FakeChatService:
    """Predictable fake that proves the route does not need a real API key."""

    def __init__(self) -> None:
        self.messages: list[str] = []

    def generate_reply(self, message: str) -> str:
        self.messages.append(message)
        return "Hello from the mocked Gemini service."


class FailingChatService:
    def generate_reply(self, message: str) -> str:
        raise AIServiceError("Provider diagnostic that users must not see")


async def post_chat(payload: dict[str, str]) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.post("/api/chat", json=payload)


def test_chat_returns_reply_from_the_service() -> None:
    fake_service = FakeChatService()
    app.dependency_overrides[get_chat_service] = lambda: fake_service

    try:
        response = asyncio.run(post_chat({"message": "  Hello  "}))
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"reply": "Hello from the mocked Gemini service."}
    assert fake_service.messages == ["Hello"]


def test_chat_hides_provider_errors() -> None:
    app.dependency_overrides[get_chat_service] = FailingChatService

    try:
        response = asyncio.run(post_chat({"message": "Hello"}))
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 502
    assert response.json() == {
        "detail": "The AI service is unavailable. Please try again."
    }


def test_chat_rejects_a_blank_message() -> None:
    response = asyncio.run(post_chat({"message": "   "}))

    assert response.status_code == 422


def test_chat_rate_limit_returns_retry_information(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_service = FakeChatService()
    monkeypatch.setattr(main_module, "chat_rate_limiter", RateLimiter(2, 60))
    app.dependency_overrides[get_chat_service] = lambda: fake_service

    try:
        first = asyncio.run(post_chat({"message": "First"}))
        second = asyncio.run(post_chat({"message": "Second"}))
        limited = asyncio.run(post_chat({"message": "Third"}))
    finally:
        app.dependency_overrides.clear()

    assert first.status_code == 200
    assert second.status_code == 200
    assert limited.status_code == 429
    assert limited.headers["retry-after"].isdigit()
    assert limited.json()["detail"] == "Too many chat requests. Please wait a moment and try again."
