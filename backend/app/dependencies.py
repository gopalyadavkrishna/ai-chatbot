"""Shared request dependencies for authenticated routes."""

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import RevokedToken, User
from .security import AuthenticationConfigurationError, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    user: User
    token_id: str
    expires_at: datetime


def credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    """Resolve the bearer token to an active user and reject logged-out tokens."""
    if credentials is None:
        raise credentials_error()

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
        token_id = payload["jti"]
        expires_at = datetime.fromtimestamp(float(payload["exp"]), timezone.utc)
    except (AuthenticationConfigurationError, KeyError, TypeError, ValueError):
        raise credentials_error() from None

    if not isinstance(token_id, str):
        raise credentials_error()

    revoked_token = db.scalar(
        select(RevokedToken).where(RevokedToken.token_id == token_id)
    )
    user = db.get(User, user_id)
    if revoked_token is not None or user is None:
        raise credentials_error()

    return AuthContext(user=user, token_id=token_id, expires_at=expires_at)


def get_current_user(auth: AuthContext = Depends(get_current_auth)) -> User:
    """Provide the user for routes that do not need token metadata."""
    return auth.user
