"""Tests for PDF/TXT knowledge-base upload and simple retrieval."""

import asyncio
from collections.abc import Generator

import httpx
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.database import Base, get_db
from app.gemini import get_chat_service
from app.main import app
from app.models import DocumentChunk


class FakeKnowledgeService:
    """Provides stable vectors and replies without calling Gemini in tests."""

    def __init__(self) -> None:
        self.knowledge_contexts: list[str | None] = []

    def generate_reply(self, message: str) -> str:
        return "Standalone fake reply"

    def generate_reply_with_history(
        self,
        messages: list[tuple[str, str]],
        system_instructions: str,
        temperature: float,
        knowledge_context: str | None = None,
    ) -> str:
        self.knowledge_contexts.append(knowledge_context)
        if knowledge_context and knowledge_context.startswith("No relevant"):
            return "I could not find that answer in the uploaded documents."
        return "The library closes at 8 PM on weekdays."

    def generate_embeddings(self, texts: list[str], task_type: str) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            if task_type == "QUESTION_ANSWERING" and "unrelated" in text.lower():
                vectors.append([0.0, 1.0])
            else:
                vectors.append([1.0, 0.0])
        return vectors


@pytest.fixture(autouse=True)
def configured_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("JWT_SECRET", "test-secret-that-is-longer-than-thirty-two-characters")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def test_database() -> Generator[sessionmaker[Session], None, None]:
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
    yield testing_session
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


async def send_request(
    method: str,
    path: str,
    *,
    body: dict[str, object] | None = None,
    files: dict[str, tuple[str, bytes, str]] | None = None,
    token: str | None = None,
) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, path, json=body, files=files, headers=headers)


def request(
    method: str,
    path: str,
    *,
    body: dict[str, object] | None = None,
    files: dict[str, tuple[str, bytes, str]] | None = None,
    token: str | None = None,
) -> httpx.Response:
    return asyncio.run(send_request(method, path, body=body, files=files, token=token))


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
            "name": "Library Helper",
            "description": "Answers from campus information.",
            "system_instructions": "Be brief.",
            "welcome_message": "Ask about campus services.",
            "temperature": 0.2,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def upload_library_document(token: str, chatbot_id: int) -> int:
    response = request(
        "POST",
        f"/api/chatbots/{chatbot_id}/documents",
        token=token,
        files={
            "file": (
                "library-hours.txt",
                b"The college library closes at 8 PM on weekdays.",
                "text/plain",
            )
        },
    )
    assert response.status_code == 201
    assert response.json()["chunk_count"] == 1
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


def test_txt_upload_retrieval_sources_and_chunk_deletion(
    test_database: sessionmaker[Session],
) -> None:
    fake_ai = FakeKnowledgeService()
    app.dependency_overrides[get_chat_service] = lambda: fake_ai
    token = register("knowledge@example.com")
    chatbot_id = create_chatbot(token)

    try:
        document_id = upload_library_document(token, chatbot_id)
        conversation_id = create_conversation(token, chatbot_id)
        turn = request(
            "POST",
            f"/api/conversations/{conversation_id}/messages",
            token=token,
            body={"message": "What time does the library close?"},
        )
        saved = request("GET", f"/api/conversations/{conversation_id}", token=token)
        deleted = request("DELETE", f"/api/documents/{document_id}", token=token)
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert turn.status_code == 200
    assert turn.json()["assistant_message"]["sources"] == [
        {"document_name": "library-hours.txt", "page_number": None}
    ]
    assert "library-hours.txt" in (fake_ai.knowledge_contexts[-1] or "")
    assert saved.status_code == 200
    assert saved.json()["messages"][-1]["sources"][0]["document_name"] == "library-hours.txt"
    assert deleted.status_code == 204
    with test_database() as db:
        assert db.scalar(select(func.count()).select_from(DocumentChunk)) == 0


def test_unrelated_question_has_no_source_and_private_documents(test_database: sessionmaker[Session]) -> None:
    fake_ai = FakeKnowledgeService()
    app.dependency_overrides[get_chat_service] = lambda: fake_ai
    first_token = register("first-knowledge@example.com")
    second_token = register("second-knowledge@example.com")
    chatbot_id = create_chatbot(first_token)

    try:
        document_id = upload_library_document(first_token, chatbot_id)
        conversation_id = create_conversation(first_token, chatbot_id)
        turn = request(
            "POST",
            f"/api/conversations/{conversation_id}/messages",
            token=first_token,
            body={"message": "Tell me about an unrelated astronomy topic."},
        )
        forbidden_list = request(
            "GET", f"/api/chatbots/{chatbot_id}/documents", token=second_token
        )
        forbidden_delete = request("DELETE", f"/api/documents/{document_id}", token=second_token)
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert turn.status_code == 200
    assert turn.json()["assistant_message"]["sources"] == []
    assert fake_ai.knowledge_contexts[-1] == (
        "No relevant passages were found in the uploaded documents for this question."
    )
    assert forbidden_list.status_code == 404
    assert forbidden_delete.status_code == 404


def test_invalid_file_type_is_rejected(test_database: sessionmaker[Session]) -> None:
    fake_ai = FakeKnowledgeService()
    app.dependency_overrides[get_chat_service] = lambda: fake_ai
    token = register("invalid-file@example.com")
    chatbot_id = create_chatbot(token)

    try:
        response = request(
            "POST",
            f"/api/chatbots/{chatbot_id}/documents",
            token=token,
            files={"file": ("not-a-pdf.pdf", b"not actually a PDF", "application/pdf")},
        )
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert response.status_code == 400
    assert response.json()["detail"] == "The PDF file is not valid."
