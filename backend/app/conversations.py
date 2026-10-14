"""Conversation history and message routes for owned chatbots."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .chatbots import owned_chatbot_or_404
from .database import get_db
from .dependencies import get_current_user
from .gemini import AIServiceError, ChatService, get_chat_service
from .knowledge import build_knowledge_context, find_relevant_chunks
from .models import Conversation, Document, Message, MessageSource, User
from .rate_limit import chat_rate_limiter, enforce_rate_limit
from .schemas import (
    ChatTurnResponse,
    ConversationCreate,
    ConversationDetail,
    ConversationRead,
    ConversationUpdate,
    MessageCreate,
)

router = APIRouter(tags=["conversations"])
CONTEXT_MESSAGE_LIMIT = 12


def owned_conversation_or_404(
    conversation_id: int, user_id: int, db: Session
) -> Conversation:
    """Return a conversation only when it belongs to the current user."""
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.owner_id == user_id
        )
    )
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found."
        )
    return conversation


@router.get(
    "/api/chatbots/{chatbot_id}/conversations", response_model=list[ConversationRead]
)
def list_conversations(
    chatbot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Conversation]:
    """List recent conversations for one owned chatbot."""
    owned_chatbot_or_404(chatbot_id, current_user.id, db)
    return list(
        db.scalars(
            select(Conversation)
            .where(
                Conversation.chatbot_id == chatbot_id,
                Conversation.owner_id == current_user.id,
            )
            .order_by(Conversation.updated_at.desc())
        )
    )


@router.post(
    "/api/chatbots/{chatbot_id}/conversations",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    chatbot_id: int,
    conversation_data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Conversation:
    """Start an empty conversation owned by the current user."""
    owned_chatbot_or_404(chatbot_id, current_user.id, db)
    conversation = Conversation(
        owner_id=current_user.id,
        chatbot_id=chatbot_id,
        title=conversation_data.title,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/api/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Conversation:
    """Open a conversation and all of its saved messages."""
    conversation = db.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages).selectinload(Message.sources))
        .where(
            Conversation.id == conversation_id,
            Conversation.owner_id == current_user.id,
        )
    )
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found."
        )
    return conversation


@router.patch("/api/conversations/{conversation_id}", response_model=ConversationRead)
def rename_conversation(
    conversation_id: int,
    conversation_data: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Conversation:
    """Rename an owned conversation from the history sidebar."""
    conversation = owned_conversation_or_404(conversation_id, current_user.id, db)
    conversation.title = conversation_data.title
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete(
    "/api/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete an owned conversation and its messages."""
    conversation = owned_conversation_or_404(conversation_id, current_user.id, db)
    db.delete(conversation)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/api/conversations/{conversation_id}/messages", response_model=ChatTurnResponse
)
def send_message(
    conversation_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatTurnResponse:
    """Save a turn, then ask Gemini with only the newest saved messages."""
    enforce_rate_limit(chat_rate_limiter, f"user:{current_user.id}")
    conversation = owned_conversation_or_404(conversation_id, current_user.id, db)
    chatbot = owned_chatbot_or_404(conversation.chatbot_id, current_user.id, db)

    user_message = Message(
        conversation_id=conversation.id, role="user", content=message_data.message
    )
    db.add(user_message)
    if conversation.title == "New conversation":
        conversation.title = message_data.message[:120]
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user_message)

    recent_messages = list(
        reversed(
            list(
                db.scalars(
                    select(Message)
                    .where(Message.conversation_id == conversation.id)
                    .order_by(Message.created_at.desc(), Message.id.desc())
                    .limit(CONTEXT_MESSAGE_LIMIT)
                )
            )
        )
    )
    history = [(message.role, message.content) for message in recent_messages]
    has_documents = (
        db.scalar(
            select(Document.id)
            .where(Document.chatbot_id == chatbot.id, Document.owner_id == current_user.id)
            .limit(1)
        )
        is not None
    )

    try:
        if has_documents:
            relevant_chunks = find_relevant_chunks(
                chatbot_id=chatbot.id,
                question=message_data.message,
                db=db,
                chat_service=chat_service,
            )
            reply = chat_service.generate_reply_with_history(
                history,
                chatbot.system_instructions,
                chatbot.temperature,
                knowledge_context=build_knowledge_context(relevant_chunks),
            )
        else:
            relevant_chunks = []
            reply = chat_service.generate_reply_with_history(
                history, chatbot.system_instructions, chatbot.temperature
            )
    except AIServiceError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service is unavailable. Please try again.",
        ) from error

    assistant_message = Message(
        conversation_id=conversation.id, role="assistant", content=reply
    )
    seen_sources: set[tuple[str, int | None]] = set()
    for chunk in relevant_chunks:
        source_key = (chunk.document_name, chunk.page_number)
        if source_key not in seen_sources:
            assistant_message.sources.append(
                MessageSource(
                    document_name=chunk.document_name, page_number=chunk.page_number
                )
            )
            seen_sources.add(source_key)
    db.add(assistant_message)
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conversation)
    db.refresh(assistant_message)

    return ChatTurnResponse(
        conversation=conversation,
        user_message=user_message,
        assistant_message=assistant_message,
    )
