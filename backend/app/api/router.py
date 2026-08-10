"""Top-level API router."""

from fastapi import APIRouter

from app.api.routes import auth, example, projects, status, tasks

router = APIRouter()
router.include_router(status.router)
router.include_router(example.router)
router.include_router(auth.router)
router.include_router(projects.router)
router.include_router(tasks.router)
