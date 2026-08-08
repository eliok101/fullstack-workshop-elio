"""Project routes."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.projects import list_projects_visible_to_user
from app.schemas.projects import (
    ProjectCreate,
    ProjectPublicSummary,
    ProjectRead,
    ProjectUpdate,
)
from app.services.projects import (
    create_project_with_owner,
    delete_project,
    get_public_project_summary,
    get_visible_project_or_404,
    update_project,
)

router = APIRouter(tags=["projects"])

FAKE_CURRENT_USER_ID = 1  # temporary until Module 08 authentication - requires a user with this id to exist (see learning log, Module 07 Step 7)


@router.get("/projects", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectRead]:
    projects = list_projects_visible_to_user(db, FAKE_CURRENT_USER_ID)
    return [ProjectRead.model_validate(p) for p in projects]


@router.post(
    "/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED
)
def create_project(
    payload: ProjectCreate, db: Session = Depends(get_db)
) -> ProjectRead:
    project = create_project_with_owner(
        db,
        name=payload.name,
        description=payload.description,
        is_public=payload.is_public,
        owner_id=FAKE_CURRENT_USER_ID,
    )
    return ProjectRead.model_validate(project)


@router.get("/projects/public/{slug}", response_model=ProjectPublicSummary)
def get_public_project(
    slug: str, db: Session = Depends(get_db)
) -> ProjectPublicSummary:
    return get_public_project_summary(db, slug)


@router.get("/projects/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)) -> ProjectRead:
    project = get_visible_project_or_404(db, project_id, FAKE_CURRENT_USER_ID)
    return ProjectRead.model_validate(project)


@router.patch("/projects/{project_id}", response_model=ProjectRead)
def patch_project(
    project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)
) -> ProjectRead:
    project = get_visible_project_or_404(db, project_id, FAKE_CURRENT_USER_ID)
    update_data = payload.model_dump(exclude_unset=True)
    updated = update_project(db, project, update_data, FAKE_CURRENT_USER_ID)
    return ProjectRead.model_validate(updated)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project(project_id: int, db: Session = Depends(get_db)) -> None:
    project = get_visible_project_or_404(db, project_id, FAKE_CURRENT_USER_ID)
    delete_project(db, project, FAKE_CURRENT_USER_ID)
