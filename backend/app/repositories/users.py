"""Focused query operations for the User resource."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()


def get_active_user_by_id(db: Session, user_id: int) -> User | None:
    return db.execute(
        select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
    ).scalar_one_or_none()
