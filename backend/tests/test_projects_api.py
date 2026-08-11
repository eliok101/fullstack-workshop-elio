"""Integration tests for project routes, hitting the real FastAPI app via TestClient."""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

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


class AuthContext:
    def __init__(self, token: str, email: str, created_project_ids: list[int]):
        self.token = token
        self.email = email
        self.created_project_ids = created_project_ids

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


@pytest.fixture(autouse=True)
def auth_ctx():
    email = f"test-user-{uuid.uuid4().hex}@example.com"
    password = "TestPassword123!"

    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Test User", "password": password},
    )
    assert register_response.status_code == 201, register_response.text

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["access_token"]

    created_project_ids: list[int] = []
    ctx = AuthContext(token, email, created_project_ids)

    yield ctx

    cleanup_db = SessionLocal()
    cleanup_db.execute(delete(Task).where(Task.project_id.in_(created_project_ids)))
    cleanup_db.execute(
        delete(ProjectMember).where(ProjectMember.project_id.in_(created_project_ids))
    )
    cleanup_db.execute(delete(Project).where(Project.id.in_(created_project_ids)))
    cleanup_db.execute(delete(User).where(User.email == email))
    cleanup_db.commit()
    cleanup_db.close()


def test_create_and_get_project(auth_ctx):
    create_response = client.post(
        "/api/v1/projects",
        json={"name": "API Test Project", "description": "desc", "is_public": True},
        headers=auth_ctx.headers,
    )
    assert create_response.status_code == 201
    body = create_response.json()
    assert body["name"] == "API Test Project"
    assert body["slug"] == "api-test-project"
    auth_ctx.created_project_ids.append(body["id"])

    project_id = body["id"]
    get_response = client.get(
        f"/api/v1/projects/{project_id}", headers=auth_ctx.headers
    )
    assert get_response.status_code == 200
    assert get_response.json()["id"] == project_id


def test_duplicate_name_gets_suffixed_slug(auth_ctx):
    first = client.post(
        "/api/v1/projects",
        json={"name": "Duplicate Name", "is_public": False},
        headers=auth_ctx.headers,
    )
    second = client.post(
        "/api/v1/projects",
        json={"name": "Duplicate Name", "is_public": False},
        headers=auth_ctx.headers,
    )
    auth_ctx.created_project_ids.append(first.json()["id"])
    auth_ctx.created_project_ids.append(second.json()["id"])
    assert first.json()["slug"] == "duplicate-name"
    assert second.json()["slug"] == "duplicate-name-2"


def test_unknown_project_returns_404(auth_ctx):
    response = client.get("/api/v1/projects/999999", headers=auth_ctx.headers)
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_public_project_summary_excludes_private_fields(auth_ctx):
    create_response = client.post(
        "/api/v1/projects",
        json={"name": "Public Summary Test", "is_public": True},
        headers=auth_ctx.headers,
    )
    auth_ctx.created_project_ids.append(create_response.json()["id"])
    slug = create_response.json()["slug"]

    # Deliberately unauthenticated - this is the one endpoint designed to
    # require no login at all.
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
