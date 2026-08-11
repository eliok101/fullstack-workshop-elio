"""Authentication service operations."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import hash_password, verify_password
from app.core.tokens import create_access_token, create_refresh_token
from app.db.models import User
from app.repositories.users import get_user_by_email

# A valid Argon2 hash of an arbitrary, never-used password. Used to normalize
# authentication timing when no matching user exists, so verify_password's
# deliberately slow computation always runs - preventing an attacker from
# distinguishing "no such account" from "wrong password" via response timing.
_DUMMY_HASH = hash_password("this-password-is-never-used-timing-defense-only")


def register_user(db: Session, email: str, full_name: str, password: str) -> User:
    existing = get_user_by_email(db, email)
    if existing is not None:
        raise ConflictError(f"A user with email '{email}' already exists")

    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password(password),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(f"A user with email '{email}' already exists") from exc
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    hash_to_check = user.password_hash if user is not None else _DUMMY_HASH
    password_ok = verify_password(password, hash_to_check)

    if user is None or not password_ok:
        raise UnauthorizedError("Invalid email or password")
    return user


def create_token_pair(user_id: int) -> tuple[str, str]:
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    return access, refresh
