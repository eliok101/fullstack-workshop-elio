"""Project-related service operations."""

import re
from typing import Any

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.db.models import Project, ProjectMember
from app.repositories.projects import (
    get_project_by_id,
    get_project_by_slug,
    get_project_task_counts,
    is_project_visible_to_user,
    slug_exists,
)
from app.schemas.projects import ProjectPublicSummary


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "project"


def generate_unique_slug(db: Session, name: str) -> str:
    base_slug = slugify(name)
    candidate = base_slug
    suffix = 2
    while slug_exists(db, candidate):
        candidate = f"{base_slug}-{suffix}"
        suffix += 1
    return candidate


def create_project_with_owner(
    db: Session,
    name: str,
    description: str | None,
    is_public: bool,
    owner_id: int,
) -> Project:
    slug = generate_unique_slug(db, name)
    project = Project(
        name=name,
        slug=slug,
        description=description,
        is_public=is_public,
        owner_id=owner_id,
    )
    db.add(project)
    db.flush()

    membership = ProjectMember(project_id=project.id, user_id=owner_id, role="owner")
    db.add(membership)
    return project


def get_visible_project_or_404(db: Session, project_id: int, user_id: int) -> Project:
    project = get_project_by_id(db, project_id)
    if project is None or not is_project_visible_to_user(db, project, user_id):
        raise NotFoundError(f"Project {project_id} not found")
    return project


def update_project(
    db: Session, project: Project, update_data: dict[str, Any], requesting_user_id: int
) -> Project:
    if project.owner_id != requesting_user_id:
        raise NotFoundError(f"Project {project.id} not found")

    for field, value in update_data.items():
        setattr(project, field, value)
    db.flush()
    return project


def delete_project(db: Session, project: Project, requesting_user_id: int) -> None:
    if project.owner_id != requesting_user_id:
        raise NotFoundError(f"Project {project.id} not found")
    db.delete(project)


def get_public_project_summary(db: Session, slug: str) -> ProjectPublicSummary:
    project = get_project_by_slug(db, slug)
    if project is None or not project.is_public:
        raise NotFoundError(f"Public project '{slug}' not found")

    total, completed = get_project_task_counts(db, project.id)
    return ProjectPublicSummary(
        name=project.name,
        slug=project.slug,
        description=project.description,
        task_count=total,
        completed_task_count=completed,
    )
