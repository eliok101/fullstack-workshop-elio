import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_request_id_generated_when_absent():
    response = client.get("/health/live")
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0


def test_request_id_preserved_when_provided():
    response = client.get(
        "/health/live", headers={"X-Request-ID": "test-fixed-id-12345"}
    )
    assert response.headers["X-Request-ID"] == "test-fixed-id-12345"


def test_request_id_does_not_leak_tokens_or_bodies():
    # The middleware only reads/writes the X-Request-ID header - confirm no
    # Authorization header or request body content ends up echoed anywhere
    # in the response headers.
    response = client.get(
        "/health/live",
        headers={
            "X-Request-ID": "trace-me",
            "Authorization": "Bearer super-secret-token-value",
        },
    )
    assert "super-secret-token-value" not in str(response.headers)
    assert response.headers["X-Request-ID"] == "trace-me"
