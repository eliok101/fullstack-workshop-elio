"""Integration tests for task routes, hitting the real FastAPI app via TestClient."""

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


def _create_project(auth_ctx: AuthContext, name: str) -> dict:
    response = client.post(
        "/api/v1/projects",
        json={"name": name, "is_public": False},
        headers=auth_ctx.headers,
    )
    assert response.status_code == 201
    project = response.json()
    auth_ctx.created_project_ids.append(project["id"])
    return project


def test_create_task_and_get_it(auth_ctx):
    project = _create_project(auth_ctx, "Task Test Project")
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "First Task", "priority": "high"},
        headers=auth_ctx.headers,
    )
    assert create_response.status_code == 201
    task = create_response.json()
    assert task["status"] == "backlog"
    assert task["priority"] == "high"

    get_response = client.get(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        headers=auth_ctx.headers,
    )
    assert get_response.status_code == 200


def test_valid_transition_succeeds(auth_ctx):
    project = _create_project(auth_ctx, "Transition Test Project")
    task = client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Transition Task"},
        headers=auth_ctx.headers,
    ).json()

    response = client.patch(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        json={"status": "in_progress"},
        headers=auth_ctx.headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_invalid_direct_transition_returns_409(auth_ctx):
    project = _create_project(auth_ctx, "Invalid Transition Project")
    task = client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Bad Transition Task"},
        headers=auth_ctx.headers,
    ).json()

    response = client.patch(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        json={"status": "done"},
        headers=auth_ctx.headers,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "invalid_transition"


def test_cross_project_task_access_returns_404(auth_ctx):
    project_a = _create_project(auth_ctx, "Project A")
    project_b = _create_project(auth_ctx, "Project B")
    task = client.post(
        f"/api/v1/projects/{project_a['id']}/tasks",
        json={"title": "A's Task"},
        headers=auth_ctx.headers,
    ).json()

    response = client.get(
        f"/api/v1/projects/{project_b['id']}/tasks/{task['id']}",
        headers=auth_ctx.headers,
    )
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_filter_by_priority(auth_ctx):
    project = _create_project(auth_ctx, "Filter Priority Project")
    client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Low", "priority": "low"},
        headers=auth_ctx.headers,
    )
    client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "High 1", "priority": "high"},
        headers=auth_ctx.headers,
    )
    client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "High 2", "priority": "high"},
        headers=auth_ctx.headers,
    )

    response = client.get(
        f"/api/v1/projects/{project['id']}/tasks?priority=high",
        headers=auth_ctx.headers,
    )
    assert response.status_code == 200
    tasks = response.json()
    assert len(tasks) == 2
    assert all(t["priority"] == "high" for t in tasks)


def test_filter_combined_status_and_priority(auth_ctx):
    project = _create_project(auth_ctx, "Filter Combined Project")
    task = client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Backlog High", "priority": "high"},
        headers=auth_ctx.headers,
    ).json()
    client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Backlog Low", "priority": "low"},
        headers=auth_ctx.headers,
    )

    response = client.get(
        f"/api/v1/projects/{project['id']}/tasks?status=backlog&priority=high",
        headers=auth_ctx.headers,
    )
    assert response.status_code == 200
    tasks = response.json()
    assert len(tasks) == 1
    assert tasks[0]["id"] == task["id"]


def test_filter_invalid_status_returns_422(auth_ctx):
    project = _create_project(auth_ctx, "Filter Invalid Project")
    response = client.get(
        f"/api/v1/projects/{project['id']}/tasks?status=not_a_real_status",
        headers=auth_ctx.headers,
    )
    assert response.status_code == 422


def test_filter_no_matches_returns_empty_list(auth_ctx):
    project = _create_project(auth_ctx, "Filter No Match Project")
    client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Only Task", "priority": "low"},
        headers=auth_ctx.headers,
    )

    response = client.get(
        f"/api/v1/projects/{project['id']}/tasks?priority=medium",
        headers=auth_ctx.headers,
    )
    assert response.status_code == 200
    assert response.json() == []


def test_stranger_cannot_update_task(auth_ctx):
    project = _create_project(auth_ctx, "Stranger Update Project")
    task = client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Owner's Task"},
        headers=auth_ctx.headers,
    ).json()

    stranger = _register_second_user(auth_ctx)
    response = client.patch(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        json={"status": "in_progress"},
        headers=stranger.headers,
    )
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"

    unchanged = client.get(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        headers=auth_ctx.headers,
    ).json()
    assert unchanged["status"] == "backlog"


def test_stranger_cannot_delete_task(auth_ctx):
    project = _create_project(auth_ctx, "Stranger Delete Project")
    task = client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "Owner's Task"},
        headers=auth_ctx.headers,
    ).json()

    stranger = _register_second_user(auth_ctx)
    response = client.delete(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        headers=stranger.headers,
    )
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"

    still_there = client.get(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        headers=auth_ctx.headers,
    )
    assert still_there.status_code == 200
