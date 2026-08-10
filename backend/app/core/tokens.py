"""JWT access/refresh token creation and verification."""
from datetime import datetime, timedelta, timezone
from enum import StrEnum

import jwt

from app.core.config import get_settings


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class InvalidTokenError(Exception):
    """Raised when a token is malformed, expired, or the wrong type."""


def _create_token(user_id: int, token_type: TokenType, expires_delta: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type.value,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    return _create_token(
        user_id, TokenType.ACCESS, timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(user_id: int) -> str:
    settings = get_settings()
    return _create_token(
        user_id, TokenType.REFRESH, timedelta(days=settings.refresh_token_expire_days)
    )


def decode_token(token: str, expected_type: TokenType) -> int:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(f"Token could not be decoded: {exc}") from exc

    if payload.get("type") != expected_type.value:
        raise InvalidTokenError(
            f"Expected token type '{expected_type.value}', got '{payload.get('type')}'"
        )

    try:
        return int(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise InvalidTokenError("Token missing valid subject claim") from exc
