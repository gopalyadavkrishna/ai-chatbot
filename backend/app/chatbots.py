"""Authenticated CRUD routes for a user's custom chatbots."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import get_current_user
from .models import Chatbot, User
from .schemas import ChatbotCreate, ChatbotRead, ChatbotUpdate

router = APIRouter(prefix="/api/chatbots", tags=["chatbots"])


def owned_chatbot_or_404(chatbot_id: int, user_id: int, db: Session) -> Chatbot:
    """Fetch a chatbot only when it belongs to the current user."""
    chatbot = db.scalar(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.owner_id == user_id)
    )
    if chatbot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chatbot not found.")
    return chatbot


@router.get("", response_model=list[ChatbotRead])
def list_chatbots(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Chatbot]:
    """List only chatbots owned by the authenticated user."""
    return list(
        db.scalars(
            select(Chatbot)
            .where(Chatbot.owner_id == current_user.id)
            .order_by(Chatbot.created_at.desc())
        )
    )


@router.post("", response_model=ChatbotRead, status_code=status.HTTP_201_CREATED)
def create_chatbot(
    chatbot_data: ChatbotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chatbot:
    """Create a chatbot for the current user."""
    chatbot = Chatbot(owner_id=current_user.id, **chatbot_data.model_dump())
    db.add(chatbot)
    db.commit()
    db.refresh(chatbot)
    return chatbot


@router.get("/{chatbot_id}", response_model=ChatbotRead)
def get_chatbot(
    chatbot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chatbot:
    return owned_chatbot_or_404(chatbot_id, current_user.id, db)


@router.put("/{chatbot_id}", response_model=ChatbotRead)
def update_chatbot(
    chatbot_id: int,
    chatbot_data: ChatbotUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Chatbot:
    """Replace an owned chatbot with the values from the builder form."""
    chatbot = owned_chatbot_or_404(chatbot_id, current_user.id, db)
    for field_name, value in chatbot_data.model_dump().items():
        setattr(chatbot, field_name, value)
    db.commit()
    db.refresh(chatbot)
    return chatbot


@router.delete("/{chatbot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chatbot(
    chatbot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete an owned chatbot."""
    chatbot = owned_chatbot_or_404(chatbot_id, current_user.id, db)
    db.delete(chatbot)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
