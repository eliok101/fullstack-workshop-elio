"""Health check routes."""

from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(tags=["health"])


def get_database_ready() -> bool:
    # MODULE 18 DELIBERATE DRILL — always-fail readiness. Revert after the drill.
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="database unavailable",
    )


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
