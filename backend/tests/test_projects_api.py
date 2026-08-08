"""Integration tests for project routes, hitting the real FastAPI app via TestClient."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.api.routes.projects import FAKE_CURRENT_USER_ID
from app.db.models import Project, ProjectMember, Task, User
from app.db.session import SessionLocal, get_db
from app.main import app


def override_get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def seed_user_and_cleanup():
    db = SessionLocal()
    existing = db.get(User, FAKE_CURRENT_USER_ID)
    if existing is None:
        user = User(
            id=FAKE_CURRENT_USER_ID,
            email="fake-current-user@example.com",
            full_name="Fake Current User",
            password_hash="not-a-real-hash",
        )
        db.add(user)
        db.commit()
    db.close()

    created_project_ids: list[int] = []
    yield created_project_ids

    # Scoped to only the projects this test run created - a blanket
    # delete(Project) would violate tasks_project_id_fkey against
    # unrelated, already-committed leftover data from Module 06.
    cleanup_db = SessionLocal()
    cleanup_db.execute(delete(Task).where(Task.project_id.in_(created_project_ids)))
    cleanup_db.execute(
        delete(ProjectMember).where(ProjectMember.project_id.in_(created_project_ids))
    )
    cleanup_db.execute(delete(Project).where(Project.id.in_(created_project_ids)))
    cleanup_db.commit()
    cleanup_db.close()


def test_create_and_get_project(seed_user_and_cleanup):
    create_response = client.post(
        "/api/v1/projects",
        json={"name": "API Test Project", "description": "desc", "is_public": True},
    )
    assert create_response.status_code == 201
    body = create_response.json()
    assert body["name"] == "API Test Project"
    assert body["slug"] == "api-test-project"
    seed_user_and_cleanup.append(body["id"])

    project_id = body["id"]
    get_response = client.get(f"/api/v1/projects/{project_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == project_id


def test_duplicate_name_gets_suffixed_slug(seed_user_and_cleanup):
    first = client.post(
        "/api/v1/projects", json={"name": "Duplicate Name", "is_public": False}
    )
    second = client.post(
        "/api/v1/projects", json={"name": "Duplicate Name", "is_public": False}
    )
    seed_user_and_cleanup.append(first.json()["id"])
    seed_user_and_cleanup.append(second.json()["id"])
    assert first.json()["slug"] == "duplicate-name"
    assert second.json()["slug"] == "duplicate-name-2"


def test_unknown_project_returns_404():
    response = client.get("/api/v1/projects/999999")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_public_project_summary_excludes_private_fields(seed_user_and_cleanup):
    create_response = client.post(
        "/api/v1/projects", json={"name": "Public Summary Test", "is_public": True}
    )
    seed_user_and_cleanup.append(create_response.json()["id"])
    slug = create_response.json()["slug"]

    response = client.get(f"/api/v1/projects/public/{slug}")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "name",
        "slug",
        "description",
        "task_count",
        "completed_task_count",
    }
    assert "owner_id" not in body
