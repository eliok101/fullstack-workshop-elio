"""Security-focused tests for authentication: token type discrimination, CORS, and generic error responses."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.core.config import get_settings
from app.core.tokens import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    InvalidTokenError,
)
from app.db.models import User
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
def cleanup_test_users():
    yield
    db = SessionLocal()
    db.execute(delete(User).where(User.email.like("%security-test%")))
    db.commit()
    db.close()


def test_refresh_token_rejected_as_access_token():
    refresh = create_refresh_token(user_id=1)
    with pytest.raises(InvalidTokenError):
        decode_token(refresh, TokenType.ACCESS)


def test_access_token_rejected_as_refresh_token():
    access = create_access_token(user_id=1)
    with pytest.raises(InvalidTokenError):
        decode_token(access, TokenType.REFRESH)


def test_protected_route_rejects_missing_auth():
    response = client.get("/api/v1/projects")
    assert response.status_code == 401


def test_protected_route_rejects_garbage_token():
    response = client.get(
        "/api/v1/projects", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


def test_register_then_login_then_access_protected_route():
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "security-test-flow@example.com",
            "full_name": "Security Test",
            "password": "SecurePassword123!",
        },
    )
    assert register_response.status_code == 201
    assert "password_hash" not in register_response.json()
    assert "password" not in register_response.json()

    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "security-test-flow@example.com",
            "password": "SecurePassword123!",
        },
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]

    projects_response = client.get(
        "/api/v1/projects", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert projects_response.status_code == 200


def test_wrong_password_and_nonexistent_email_return_identical_error():
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "security-test-timing@example.com",
            "full_name": "Timing Test",
            "password": "RealPassword123!",
        },
    )

    wrong_password_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "security-test-timing@example.com",
            "password": "WrongPassword123!",
        },
    )
    nonexistent_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "security-test-does-not-exist@example.com",
            "password": "AnyPassword123!",
        },
    )

    assert (
        wrong_password_response.status_code == nonexistent_response.status_code == 401
    )
    assert wrong_password_response.json() == nonexistent_response.json()


def test_duplicate_registration_returns_409():
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "security-test-dup@example.com",
            "full_name": "Dup Test",
            "password": "Password123!",
        },
    )
    second_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "security-test-dup@example.com",
            "full_name": "Dup Test 2",
            "password": "Password456!",
        },
    )
    assert second_response.status_code == 409


def test_cors_preflight_rejects_disallowed_origin():
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://evil-site.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert "access-control-allow-origin" not in response.headers


def test_cors_preflight_allows_configured_origin():
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert (
        response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    )


def test_registration_race_condition_returns_409_not_500():
    """Simulates the exact TOCTOU race fixed in Module 08: a real conflicting
    row already exists, but the service's own pre-check is patched to report
    "no existing user" - exactly what it would deterministically see under a
    genuine concurrent registration. The only thing left to prevent a
    duplicate row is the database's own unique constraint on User.email, so
    this proves the `except IntegrityError` branch in register_user actually
    fires and converts a raw database error into a clean 409, not an
    unhandled 500."""
    email = "security-test-race@example.com"
    db = SessionLocal()
    db.add(
        User(
            email=email,
            full_name="Race Condition Target",
            password_hash="not-a-real-hash",
        )
    )
    db.commit()
    db.close()

    with patch("app.services.auth.get_user_by_email", return_value=None):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "full_name": "Racer",
                "password": "RacePassword123!",
            },
        )

    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


def test_decode_token_rejects_missing_subject_claim():
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        # deliberately no "sub" claim
        "type": TokenType.ACCESS.value,
        "iat": now,
        "exp": now + timedelta(minutes=15),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm="HS256")

    with pytest.raises(InvalidTokenError):
        decode_token(token, TokenType.ACCESS)


def test_decode_token_rejects_non_numeric_subject_claim():
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "not-a-numeric-user-id",
        "type": TokenType.ACCESS.value,
        "iat": now,
        "exp": now + timedelta(minutes=15),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm="HS256")

    with pytest.raises(InvalidTokenError):
        decode_token(token, TokenType.ACCESS)
