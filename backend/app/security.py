"""Password hashing and signed access-token helpers."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
import jwt
from jwt import InvalidTokenError

from .config import get_settings

ALGORITHM = "HS256"


class AuthenticationConfigurationError(Exception):
    """Raised when a safe JWT secret has not been configured yet."""


def hash_password(password: str) -> str:
    """Hash a password with bcrypt before it is stored in SQLite."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Return whether a plaintext password matches the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    """Create a signed, time-limited token with an ID for logout revocation."""
    settings = get_settings()
    secret = settings.jwt_secret
    if len(secret) < 32 or secret.startswith("replace_with_"):
        raise AuthenticationConfigurationError("JWT secret is not configured.")

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": str(user_id), "jti": uuid4().hex, "exp": expires_at},
        secret,
        algorithm=ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, object]:
    """Decode a token and normalize all token-validation failures."""
    settings = get_settings()
    secret = settings.jwt_secret
    if len(secret) < 32 or secret.startswith("replace_with_"):
        raise AuthenticationConfigurationError("JWT secret is not configured.")

    try:
        return jwt.decode(token, secret, algorithms=[ALGORITHM])
    except InvalidTokenError as error:
        raise ValueError("Invalid access token.") from error
