"""FastAPI application entry point for CustomAI Studio."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router
from .chatbots import router as chatbot_router
from .conversations import router as conversation_router
from .database import init_db
from .gemini import AIServiceError, ChatService, get_chat_service
from .knowledge import router as knowledge_router
from .rate_limit import chat_rate_limiter, enforce_rate_limit
from .schemas import ChatRequest, ChatResponse


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Set up local database tables before accepting requests."""
    init_db()
    yield


app = FastAPI(
    title="CustomAI Studio API",
    version="0.1.0",
    description="Backend API for CustomAI Studio.",
    lifespan=lifespan,
)

# The Next.js development server runs on port 3000. The key never reaches it;
# this only permits its browser requests to reach the local API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router)
app.include_router(chatbot_router)
app.include_router(conversation_router)
app.include_router(knowledge_router)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Return a small status response used to verify that the API is running."""
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse, tags=["chat"])
def chat(
    request: ChatRequest,
    http_request: Request,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    """Send one user message to Gemini and return its text reply."""
    client_host = http_request.client.host if http_request.client else "unknown"
    enforce_rate_limit(chat_rate_limiter, f"ip:{client_host}")
    try:
        reply = chat_service.generate_reply(request.message)
    except AIServiceError as error:
        # The original provider error is deliberately not returned to users.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service is unavailable. Please try again.",
        ) from error

    return ChatResponse(reply=reply)
