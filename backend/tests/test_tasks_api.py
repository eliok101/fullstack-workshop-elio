"""Integration tests for task routes, hitting the real FastAPI app via TestClient."""
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

    cleanup_db = SessionLocal()
    cleanup_db.execute(delete(Task).where(Task.project_id.in_(created_project_ids)))
    cleanup_db.execute(
        delete(ProjectMember).where(ProjectMember.project_id.in_(created_project_ids))
    )
    cleanup_db.execute(delete(Project).where(Project.id.in_(created_project_ids)))
    cleanup_db.commit()
    cleanup_db.close()


def _create_project(created_project_ids: list[int], name: str) -> dict:
    response = client.post("/api/v1/projects", json={"name": name, "is_public": False})
    assert response.status_code == 201
    project = response.json()
    created_project_ids.append(project["id"])
    return project


def test_create_task_and_get_it(seed_user_and_cleanup):
    project = _create_project(seed_user_and_cleanup, "Task Test Project")
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/tasks",
        json={"title": "First Task", "priority": "high"},
    )
    assert create_response.status_code == 201
    task = create_response.json()
    assert task["status"] == "backlog"
    assert task["priority"] == "high"

    get_response = client.get(f"/api/v1/projects/{project['id']}/tasks/{task['id']}")
    assert get_response.status_code == 200


def test_valid_transition_succeeds(seed_user_and_cleanup):
    project = _create_project(seed_user_and_cleanup, "Transition Test Project")
    task = client.post(
        f"/api/v1/projects/{project['id']}/tasks", json={"title": "Transition Task"}
    ).json()

    response = client.patch(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}",
        json={"status": "in_progress"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_invalid_direct_transition_returns_409(seed_user_and_cleanup):
    project = _create_project(seed_user_and_cleanup, "Invalid Transition Project")
    task = client.post(
        f"/api/v1/projects/{project['id']}/tasks", json={"title": "Bad Transition Task"}
    ).json()

    response = client.patch(
        f"/api/v1/projects/{project['id']}/tasks/{task['id']}", json={"status": "done"}
    )
    assert response.status_code == 409
    assert response.json()["code"] == "invalid_transition"


def test_cross_project_task_access_returns_404(seed_user_and_cleanup):
    project_a = _create_project(seed_user_and_cleanup, "Project A")
    project_b = _create_project(seed_user_and_cleanup, "Project B")
    task = client.post(
        f"/api/v1/projects/{project_a['id']}/tasks", json={"title": "A's Task"}
    ).json()

    response = client.get(f"/api/v1/projects/{project_b['id']}/tasks/{task['id']}")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
