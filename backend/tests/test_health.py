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


def test_ready_health_uses_real_dependency_without_override() -> None:
    """Real safeguard, added Module 19: every test above replaces
    get_database_ready with a lambda via app.dependency_overrides, so none
    of them ever execute the real function body - confirmed by Module 18's
    own investigation, and confirmed the hard way when the Module 18 drill
    code (an unconditional `raise HTTPException(503, ...)`, never calling
    database_is_ready() at all) merged to main via PR #20 and every test in
    this file still passed, because none of them touched the real path.

    This test deliberately leaves the dependency un-overridden - it hits the
    real endpoint, which calls the real get_database_ready(), which calls
    the real database_is_ready() against the real (in-memory SQLite) test
    database configured at the top of this file. It passes today because
    the dependency genuinely queries the database and gets a real answer;
    it would fail immediately against the drill code, or against any future
    change that makes get_database_ready() stop calling database_is_ready()
    at all - the exact class of mistake that reached main undetected.
    """
    assert app.dependency_overrides == {}, (
        "this test only proves anything if no override is active"
    )
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
