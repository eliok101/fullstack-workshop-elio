"""Top-level API router."""

from fastapi import APIRouter

from app.api.routes import example, projects, status, tasks

router = APIRouter()
router.include_router(status.router)
router.include_router(example.router)
router.include_router(projects.router)
router.include_router(tasks.router)
