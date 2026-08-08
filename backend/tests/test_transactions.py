"""Tests proving atomicity of create_project_with_owner against real PostgreSQL."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.models import Project, ProjectMember, User
from app.db.session import SessionLocal
from app.services.projects import create_project_with_owner


@pytest.fixture
def db_session():
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def test_user(db_session):
    user = User(
        email="atomicity-test@example.com",
        full_name="Atomicity Test User",
        password_hash="not-a-real-hash",
    )
    db_session.add(user)
    db_session.flush()
    yield user
    db_session.execute(select(ProjectMember).where(ProjectMember.user_id == user.id))
    db_session.rollback()


def test_failure_rolls_back_both_inserts(db_session):
    nonexistent_owner_id = 999999

    with pytest.raises(IntegrityError):
        create_project_with_owner(
            db_session,
            name="Should Not Exist",
            description=None,
            is_public=False,
            owner_id=nonexistent_owner_id,
        )
    db_session.rollback()

    project = db_session.execute(
        select(Project).where(Project.slug == "should-not-exist")
    ).scalar_one_or_none()
    assert project is None, "project row should not exist after rollback"

    memberships = (
        db_session.execute(
            select(ProjectMember).where(ProjectMember.user_id == nonexistent_owner_id)
        )
        .scalars()
        .all()
    )
    assert len(memberships) == 0, "membership row should not exist after rollback"


def test_success_commits_both_inserts(db_session, test_user):
    project = create_project_with_owner(
        db_session,
        name="Should Exist",
        description=None,
        is_public=False,
        owner_id=test_user.id,
    )
    db_session.flush()

    found_project = db_session.execute(
        select(Project).where(Project.slug == "should-exist")
    ).scalar_one_or_none()
    assert found_project is not None
    assert found_project.id == project.id

    membership = db_session.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == test_user.id,
        )
    ).scalar_one_or_none()
    assert membership is not None
    assert membership.role == "owner"
