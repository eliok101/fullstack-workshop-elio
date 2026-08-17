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
    def __init__(
        self,
        token: str,
        email: str,
        created_project_ids: list[int],
        extra_emails: list[str],
    ):
        self.token = token
        self.email = email
        self.created_project_ids = created_project_ids
        self.extra_emails = extra_emails

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


def _register_and_login(email: str, password: str) -> str:
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
    return login_response.json()["access_token"]


def _register_second_user(auth_ctx: "AuthContext") -> "AuthContext":
    """Register a genuinely distinct second user, sharing cleanup with auth_ctx."""
    email = f"test-stranger-{uuid.uuid4().hex}@example.com"
    password = "StrangerPassword123!"
    token = _register_and_login(email, password)
    auth_ctx.extra_emails.append(email)
    return AuthContext(token, email, auth_ctx.created_project_ids, [])


@pytest.fixture(autouse=True)
def auth_ctx():
    email = f"test-user-{uuid.uuid4().hex}@example.com"
    password = "TestPassword123!"
    token = _register_and_login(email, password)

    created_project_ids: list[int] = []
    extra_emails: list[str] = []
    ctx = AuthContext(token, email, created_project_ids, extra_emails)

    yield ctx

    cleanup_db = SessionLocal()
    cleanup_db.execute(delete(Task).where(Task.project_id.in_(created_project_ids)))
    cleanup_db.execute(
        delete(ProjectMember).where(ProjectMember.project_id.in_(created_project_ids))
    )
    cleanup_db.execute(delete(Project).where(Project.id.in_(created_project_ids)))
    cleanup_db.execute(delete(User).where(User.email == email))
    for extra_email in extra_emails:
        cleanup_db.execute(delete(User).where(User.email == extra_email))
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


def test_list_public_projects_excludes_private_and_is_unauthenticated(auth_ctx):
    public_response = client.post(
        "/api/v1/projects",
        json={"name": "Sitemap Included Project", "is_public": True},
        headers=auth_ctx.headers,
    )
    private_response = client.post(
        "/api/v1/projects",
        json={"name": "Sitemap Excluded Project", "is_public": False},
        headers=auth_ctx.headers,
    )
    auth_ctx.created_project_ids.append(public_response.json()["id"])
    auth_ctx.created_project_ids.append(private_response.json()["id"])
    public_slug = public_response.json()["slug"]
    private_slug = private_response.json()["slug"]

    # Deliberately unauthenticated, like /projects/public/{slug}.
    response = client.get("/api/v1/projects/public")
    assert response.status_code == 200
    slugs = [item["slug"] for item in response.json()]
    assert public_slug in slugs
    assert private_slug not in slugs
    listed = next(item for item in response.json() if item["slug"] == public_slug)
    assert set(listed.keys()) == {"slug", "updated_at"}


def test_owner_can_update_project(auth_ctx):
    create_response = client.post(
        "/api/v1/projects",
        json={"name": "Owner Update Test", "is_public": False},
        headers=auth_ctx.headers,
    )
    project_id = create_response.json()["id"]
    auth_ctx.created_project_ids.append(project_id)

    patch_response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Renamed By Owner"},
        headers=auth_ctx.headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["name"] == "Renamed By Owner"


def test_owner_can_delete_project(auth_ctx):
    create_response = client.post(
        "/api/v1/projects",
        json={"name": "Owner Delete Test", "is_public": False},
        headers=auth_ctx.headers,
    )
    project_id = create_response.json()["id"]
    auth_ctx.created_project_ids.append(project_id)

    delete_response = client.delete(
        f"/api/v1/projects/{project_id}", headers=auth_ctx.headers
    )
    assert delete_response.status_code == 204

    get_response = client.get(
        f"/api/v1/projects/{project_id}", headers=auth_ctx.headers
    )
    assert get_response.status_code == 404


def test_non_owner_cannot_update_project(auth_ctx):
    create_response = client.post(
        "/api/v1/projects",
        json={"name": "Not Yours To Edit", "is_public": False},
        headers=auth_ctx.headers,
    )
    project_id = create_response.json()["id"]
    auth_ctx.created_project_ids.append(project_id)

    stranger = _register_second_user(auth_ctx)
    patch_response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Hijacked"},
        headers=stranger.headers,
    )
    assert patch_response.status_code == 404
    assert patch_response.json()["code"] == "not_found"

    # Confirm the project genuinely wasn't modified.
    get_response = client.get(
        f"/api/v1/projects/{project_id}", headers=auth_ctx.headers
    )
    assert get_response.json()["name"] == "Not Yours To Edit"


def test_non_owner_cannot_delete_project(auth_ctx):
    create_response = client.post(
        "/api/v1/projects",
        json={"name": "Not Yours To Delete", "is_public": False},
        headers=auth_ctx.headers,
    )
    project_id = create_response.json()["id"]
    auth_ctx.created_project_ids.append(project_id)

    stranger = _register_second_user(auth_ctx)
    delete_response = client.delete(
        f"/api/v1/projects/{project_id}", headers=stranger.headers
    )
    assert delete_response.status_code == 404
    assert delete_response.json()["code"] == "not_found"

    # Confirm the project genuinely still exists for its real owner.
    get_response = client.get(
        f"/api/v1/projects/{project_id}", headers=auth_ctx.headers
    )
    assert get_response.status_code == 200
