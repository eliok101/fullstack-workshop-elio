"""PostgreSQL-specific behavior that SQLite cannot guarantee.

Isolated in its own file, separate from the fast unit-test suite, because
this test's entire purpose is different from the rest of the suite: it does
not test our application code at all, it proves a property of the database
engine itself.

TaskStatus/TaskPriority (see app/db/models.py, Module 06) are backed by
native PostgreSQL ENUM types. SQLite has no equivalent - a SQLite column
"typed" as an enum is really just a bare TEXT column with zero server-side
value enforcement; SQLite would silently accept any string. This test
bypasses the ORM and Pydantic entirely (raw SQL) to prove that PostgreSQL
itself, not just our application-level validation, rejects an invalid enum
value. This matters because it verifies the database is a genuine authority
in the layer-placement model established in Module 06, not merely a passive
store that trusts whatever the application already validated.

The extra cost (a dedicated fixture, a real INSERT, an expected rollback) is
justified because this is exactly the kind of behavior a SQLite-backed test
suite would report as "passing" while proving nothing - it would need a
CHECK constraint reimplementation to even approximate this, and that
reimplementation could silently drift from the real PostgreSQL ENUM
definition over time.
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DataError

from app.db.models import Project, User
from app.db.session import SessionLocal


@pytest.fixture
def project_owned_by_test_user():
    db = SessionLocal()
    email = f"pg-constraint-test-{uuid.uuid4().hex}@example.com"
    user = User(
        email=email,
        full_name="Postgres Constraint Test User",
        password_hash="not-a-real-hash",
    )
    db.add(user)
    db.flush()

    project = Project(
        name="Postgres Constraint Test Project",
        slug=f"pg-constraint-test-{uuid.uuid4().hex}",
        owner_id=user.id,
    )
    db.add(project)
    db.flush()

    yield db, project

    db.rollback()
    db.close()


def test_postgres_rejects_invalid_task_status_enum_value(project_owned_by_test_user):
    db, project = project_owned_by_test_user

    with pytest.raises(DataError) as exc_info:
        db.execute(
            text(
                "INSERT INTO tasks (project_id, title, status, priority) "
                "VALUES (:project_id, 'Raw SQL Test', 'not_a_real_status', 'MEDIUM')"
            ),
            {"project_id": project.id},
        )
        db.flush()

    assert "invalid input value for enum taskstatus" in str(exc_info.value)
    db.rollback()


def test_postgres_rejects_invalid_task_priority_enum_value(project_owned_by_test_user):
    db, project = project_owned_by_test_user

    with pytest.raises(DataError) as exc_info:
        db.execute(
            text(
                "INSERT INTO tasks (project_id, title, status, priority) "
                "VALUES (:project_id, 'Raw SQL Test', 'BACKLOG', 'not_a_real_priority')"
            ),
            {"project_id": project.id},
        )
        db.flush()

    assert "invalid input value for enum taskpriority" in str(exc_info.value)
    db.rollback()
