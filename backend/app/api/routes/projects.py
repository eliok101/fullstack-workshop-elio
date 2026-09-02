"""Project routes."""

import math

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.repositories.projects import (
    count_projects_visible_to_user,
    list_projects_visible_to_user,
)
from app.schemas.projects import (
    ProjectCreate,
    ProjectListResponse,
    ProjectPublicListItem,
    ProjectPublicSummary,
    ProjectRead,
    ProjectUpdate,
)
from app.services.projects import (
    create_project_with_owner,
    delete_project,
    get_public_project_summary,
    get_visible_project_or_404,
    list_public_project_summaries,
    update_project,
)

router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=ProjectListResponse)
def list_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    total = count_projects_visible_to_user(db, current_user.id)
    projects = list_projects_visible_to_user(
        db, current_user.id, limit=page_size, offset=(page - 1) * page_size
    )
    # max(1, ...) so a genuinely empty list still reports "page 1 of 1"
    # rather than "of 0" - PaginationControls treats total_pages as the
    # last valid page, and 0 would make every page look simultaneously
    # first and last in a way that's misleading rather than accurate.
    total_pages = max(1, math.ceil(total / page_size))
    return ProjectListResponse(
        items=[ProjectRead.model_validate(p) for p in projects],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED
)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectRead:
    project = create_project_with_owner(
        db,
        name=payload.name,
        description=payload.description,
        is_public=payload.is_public,
        owner_id=current_user.id,
    )
    return ProjectRead.model_validate(project)


@router.get("/projects/public", response_model=list[ProjectPublicListItem])
def list_public_projects_endpoint(
    db: Session = Depends(get_db),
) -> list[ProjectPublicListItem]:
    return list_public_project_summaries(db)


@router.get("/projects/public/{slug}", response_model=ProjectPublicSummary)
def get_public_project(
    slug: str, db: Session = Depends(get_db)
) -> ProjectPublicSummary:
    return get_public_project_summary(db, slug)


@router.get("/projects/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectRead:
    project = get_visible_project_or_404(db, project_id, current_user.id)
    return ProjectRead.model_validate(project)


@router.patch("/projects/{project_id}", response_model=ProjectRead)
def patch_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectRead:
    project = get_visible_project_or_404(db, project_id, current_user.id)
    update_data = payload.model_dump(exclude_unset=True)
    updated = update_project(db, project, update_data, current_user.id)
    return ProjectRead.model_validate(updated)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    project = get_visible_project_or_404(db, project_id, current_user.id)
    delete_project(db, project, current_user.id)
