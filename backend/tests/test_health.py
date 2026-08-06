import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.api.routes.health import get_database_ready  # noqa: E402

client = TestClient(app)


def test_live_health_does_not_require_database() -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_ready_health_success_with_override():
    app.dependency_overrides[get_database_ready] = lambda: True
    try:
        response = client.get("/health/ready")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_ready_health_failure_with_override():
    app.dependency_overrides[get_database_ready] = lambda: False
    try:
        response = client.get("/health/ready")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 503
    assert response.json()["detail"] == "database unavailable"


def test_health_combined_endpoint_uses_same_dependency():
    app.dependency_overrides[get_database_ready] = lambda: True
    try:
        response = client.get("/health")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
