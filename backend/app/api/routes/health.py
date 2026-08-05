"""Health check routes."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.session import database_is_ready

router = APIRouter(tags=["health"])


def get_database_ready() -> bool:
    try:
        return database_is_ready()
    except Exception as exc:  # database details belong in logs, not the response
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        ) from exc


def _check_readiness(is_ready: bool) -> dict[str, str]:
    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        )
    return {"status": "ready"}


@router.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "alive"}


@router.get("/health/ready")
def ready(is_ready: bool = Depends(get_database_ready)) -> dict[str, str]:
    return _check_readiness(is_ready)


@router.get("/health")
def health(is_ready: bool = Depends(get_database_ready)) -> dict[str, str]:
    return _check_readiness(is_ready)
