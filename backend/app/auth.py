"""Registration, login, and logout API routes."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import AuthContext, get_current_auth
from .models import RevokedToken, User
from .schemas import AuthResponse, Credentials
from .security import (
    AuthenticationConfigurationError,
    create_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


def auth_response(user: User) -> AuthResponse:
    try:
        token = create_access_token(user.id)
    except AuthenticationConfigurationError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured yet. Set a secure JWT_SECRET.",
        ) from error

    return AuthResponse(access_token=token, user=user)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(credentials: Credentials, db: Session = Depends(get_db)) -> AuthResponse:
    """Create one account and return a signed access token."""
    existing_user = db.scalar(select(User).where(User.email == str(credentials.email)))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    user = User(
        email=str(credentials.email), password_hash=hash_password(credentials.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(credentials: Credentials, db: Session = Depends(get_db)) -> AuthResponse:
    """Verify email and password, then issue a fresh access token."""
    user = db.scalar(select(User).where(User.email == str(credentials.email)))
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    return auth_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    auth: AuthContext = Depends(get_current_auth), db: Session = Depends(get_db)
) -> Response:
    """Revoke the current JWT so it cannot be reused after logout."""
    already_revoked = db.scalar(
        select(RevokedToken).where(RevokedToken.token_id == auth.token_id)
    )
    if already_revoked is None:
        db.add(
            RevokedToken(
                token_id=auth.token_id,
                user_id=auth.user.id,
                expires_at=auth.expires_at,
            )
        )
        db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
