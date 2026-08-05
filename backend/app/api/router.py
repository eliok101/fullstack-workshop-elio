"""Top-level API router."""

from fastapi import APIRouter

from app.api.routes import example, status

router = APIRouter()
router.include_router(status.router)
router.include_router(example.router)
