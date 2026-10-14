"""Request and response shapes for the API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(max_length=4_000)

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("Message cannot be blank.")
        return message


class ChatResponse(BaseModel):
    reply: str


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).lower()


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class ChatbotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1_000)
    system_instructions: str = Field(default="", max_length=4_000)
    welcome_message: str = Field(
        default="Hello! How can I help?", min_length=1, max_length=500
    )
    temperature: float = Field(default=0.7, ge=0, le=2)

    @field_validator("name", "welcome_message")
    @classmethod
    def required_text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("description", "system_instructions")
    @classmethod
    def optional_text_is_trimmed(cls, value: str) -> str:
        return value.strip()


class ChatbotUpdate(ChatbotCreate):
    """A complete replacement makes the first builder form easy to explain."""


class ChatbotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    system_instructions: str
    welcome_message: str
    temperature: float
    created_at: datetime


class ConversationCreate(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Title cannot be blank.")
        return title


class ConversationUpdate(ConversationCreate):
    """Only the conversation title is editable in this phase."""


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chatbot_id: int
    title: str
    created_at: datetime
    updated_at: datetime


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_name: str
    page_number: int | None


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    sources: list[SourceRead] = Field(default_factory=list)


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chatbot_id: int
    filename: str
    mime_type: str
    file_size: int
    created_at: datetime
    chunk_count: int = Field(default=0, ge=0)


class ConversationDetail(ConversationRead):
    messages: list[MessageRead]


class MessageCreate(BaseModel):
    message: str = Field(max_length=4_000)

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("Message cannot be blank.")
        return message


class ChatTurnResponse(BaseModel):
    conversation: ConversationRead
    user_message: MessageRead
    assistant_message: MessageRead
