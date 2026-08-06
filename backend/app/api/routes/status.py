"""Status routes."""

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["status"])


@router.get("/status")
def status() -> dict[str, str]:
    settings = get_settings()
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }
