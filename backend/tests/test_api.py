import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_status_response_shape():
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"service", "version", "environment"}
    assert "database_url" not in body
    assert "secret_key" not in body


def test_echo_valid_request():
    response = client.post("/api/v1/echo", json={"name": "Elio"})
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, Elio!"}


def test_echo_invalid_schema_returns_422():
    response = client.post("/api/v1/echo", json={})
    assert response.status_code == 422


def test_echo_domain_error_returns_mapped_404():
    response = client.post("/api/v1/echo", json={"name": "missing"})
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert "detail" in body
