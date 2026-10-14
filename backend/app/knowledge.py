"""Simple, local retrieval-augmented generation (RAG) for chatbot documents."""

import json
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .chatbots import owned_chatbot_or_404
from .database import get_db
from .dependencies import get_current_user
from .gemini import AIServiceError, ChatService, get_chat_service
from .models import Document, DocumentChunk, User
from .schemas import DocumentRead

router = APIRouter(tags=["knowledge base"])

MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_CHUNKS_PER_DOCUMENT = 200
CHUNK_SIZE = 900
CHUNK_OVERLAP = 150
MAX_RETRIEVED_CHUNKS = 3
MIN_RELEVANCE_SCORE = 0.45


@dataclass(frozen=True)
class ExtractedChunk:
    """Text extracted from one page or one plain-text file."""

    content: str
    page_number: int | None


@dataclass(frozen=True)
class RetrievedChunk:
    """A database chunk selected as useful for the current question."""

    content: str
    document_name: str
    page_number: int | None
    score: float


def clean_filename(filename: str | None) -> str:
    """Keep only a harmless display name; file bytes are never saved to disk."""
    name = Path((filename or "").replace("\\", "/")).name.strip()
    if not name or any(ord(character) < 32 for character in name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file name.")
    if len(name) > 255:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name is too long.")
    return name


def split_text(text: str) -> list[str]:
    """Split text into small overlapping pieces without losing word boundaries."""
    text = " ".join(text.split())
    if not text:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            word_break = text.rfind(" ", start, end)
            if word_break > start:
                end = word_break
        chunks.append(text[start:end].strip())
        if end == len(text):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def extract_chunks(filename: str, file_bytes: bytes) -> tuple[str, list[ExtractedChunk]]:
    """Validate a TXT/PDF upload and return chunkable text with page information."""
    suffix = Path(filename).suffix.lower()
    if suffix == ".txt":
        try:
            text = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="TXT files must be UTF-8 encoded.",
            ) from error
        chunks = [ExtractedChunk(part, None) for part in split_text(text)]
        mime_type = "text/plain"
    elif suffix == ".pdf":
        if not file_bytes.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The PDF file is not valid.",
            )
        try:
            reader = PdfReader(BytesIO(file_bytes))
            chunks = [
                ExtractedChunk(part, page_number)
                for page_number, page in enumerate(reader.pages, start=1)
                for part in split_text(page.extract_text() or "")
            ]
        except Exception as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The PDF could not be read. Try a text-based PDF.",
            ) from error
        mime_type = "application/pdf"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .pdf and UTF-8 .txt files are allowed.",
        )

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file does not contain readable text.",
        )
    if len(chunks) > MAX_CHUNKS_PER_DOCUMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The file creates too many text chunks. Keep it under {MAX_CHUNKS_PER_DOCUMENT} chunks.",
        )
    return mime_type, chunks


def owned_document_or_404(document_id: int, user_id: int, db: Session) -> Document:
    """Find a document only when its owner is the current user."""
    document = db.scalar(
        select(Document).where(Document.id == document_id, Document.owner_id == user_id)
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return document


def cosine_similarity(left: list[float], right: list[float]) -> float:
    """Compare two stored Gemini vectors; zero is safe for malformed values."""
    left_vector = np.asarray(left, dtype=float)
    right_vector = np.asarray(right, dtype=float)
    if left_vector.size == 0 or left_vector.size != right_vector.size:
        return 0.0
    denominator = np.linalg.norm(left_vector) * np.linalg.norm(right_vector)
    if denominator == 0:
        return 0.0
    return float(np.dot(left_vector, right_vector) / denominator)


def find_relevant_chunks(
    *, chatbot_id: int, question: str, db: Session, chat_service: ChatService
) -> list[RetrievedChunk]:
    """Embed a question and return only the close chunks owned by its chatbot."""
    query_embedding = chat_service.generate_embeddings([question], "QUESTION_ANSWERING")[0]
    chunks = list(
        db.scalars(
            select(DocumentChunk)
            .join(Document)
            .options(selectinload(DocumentChunk.document))
            .where(Document.chatbot_id == chatbot_id)
        )
    )
    ranked: list[RetrievedChunk] = []
    for chunk in chunks:
        try:
            stored_embedding = json.loads(chunk.embedding_json)
            score = cosine_similarity(query_embedding, stored_embedding)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if score >= MIN_RELEVANCE_SCORE:
            ranked.append(
                RetrievedChunk(
                    content=chunk.content,
                    document_name=chunk.document.filename,
                    page_number=chunk.page_number,
                    score=score,
                )
            )
    return sorted(ranked, key=lambda item: item.score, reverse=True)[:MAX_RETRIEVED_CHUNKS]


def build_knowledge_context(chunks: list[RetrievedChunk]) -> str:
    """Label source passages so Gemini can use them as untrusted reference data."""
    if not chunks:
        return "No relevant passages were found in the uploaded documents for this question."
    return "\n\n".join(
        "Source: %s%s\nPassage: %s"
        % (
            chunk.document_name,
            f", page {chunk.page_number}" if chunk.page_number else "",
            chunk.content,
        )
        for chunk in chunks
    )


@router.get("/api/chatbots/{chatbot_id}/documents", response_model=list[DocumentRead])
def list_documents(
    chatbot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Document]:
    """List document metadata for one owned chatbot."""
    owned_chatbot_or_404(chatbot_id, current_user.id, db)
    return list(
        db.scalars(
            select(Document)
            .options(selectinload(Document.chunks))
            .where(Document.chatbot_id == chatbot_id, Document.owner_id == current_user.id)
            .order_by(Document.created_at.desc())
        )
    )


@router.post(
    "/api/chatbots/{chatbot_id}/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    chatbot_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    chat_service: ChatService = Depends(get_chat_service),
) -> Document:
    """Index a small TXT or text-based PDF; only extracted text remains in SQLite."""
    chatbot = owned_chatbot_or_404(chatbot_id, current_user.id, db)
    filename = clean_filename(file.filename)
    try:
        file_bytes = await file.read(MAX_FILE_SIZE + 1)
    finally:
        await file.close()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty.")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Files must be 5 MB or smaller.",
        )

    mime_type, extracted_chunks = extract_chunks(filename, file_bytes)
    try:
        embeddings = chat_service.generate_embeddings(
            [chunk.content for chunk in extracted_chunks], "RETRIEVAL_DOCUMENT"
        )
    except AIServiceError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service is unavailable. Please try again.",
        ) from error

    document = Document(
        owner_id=current_user.id,
        chatbot_id=chatbot.id,
        filename=filename,
        mime_type=mime_type,
        file_size=len(file_bytes),
    )
    db.add(document)
    db.flush()
    db.add_all(
        DocumentChunk(
            document_id=document.id,
            chunk_index=index,
            page_number=chunk.page_number,
            content=chunk.content,
            embedding_json=json.dumps(embedding),
        )
        for index, (chunk, embedding) in enumerate(zip(extracted_chunks, embeddings))
    )
    db.commit()
    db.refresh(document)
    return document


@router.delete("/api/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete a document and cascade to every stored chunk and embedding."""
    document = owned_document_or_404(document_id, current_user.id, db)
    db.delete(document)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
