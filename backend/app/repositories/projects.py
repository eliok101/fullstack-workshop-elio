"""Focused query operations for the Project resource."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Project, ProjectMember, Task, TaskStatus


def get_project_by_id(db: Session, project_id: int) -> Project | None:
    return db.get(Project, project_id)


def get_project_by_slug(db: Session, slug: str) -> Project | None:
    return db.execute(select(Project).where(Project.slug == slug)).scalar_one_or_none()


def _visible_to_user_filter(user_id: int):
    """Shared WHERE clause between the page query and its count, so the two
    can never quietly drift apart (e.g. one gaining a visibility rule the
    other doesn't, which would show a total that doesn't match what a user
    can actually page through)."""
    return or_(
        Project.owner_id == user_id,
        ProjectMember.user_id == user_id,
    )


def list_projects_visible_to_user(
    db: Session, user_id: int, *, limit: int | None = None, offset: int = 0
) -> list[Project]:
    stmt = (
        select(Project)
        .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .where(_visible_to_user_filter(user_id))
        .order_by(Project.created_at.desc(), Project.id.desc())
        .distinct()
    )
    if limit is not None:
        stmt = stmt.limit(limit).offset(offset)
    return list(db.execute(stmt).scalars().all())


def count_projects_visible_to_user(db: Session, user_id: int) -> int:
    # DISTINCT count over the join, mirroring the list query's own .distinct()
    # - without it, a project with more than one ProjectMember row would be
    # counted once per membership row instead of once per project.
    stmt = (
        select(func.count(func.distinct(Project.id)))
        .select_from(Project)
        .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .where(_visible_to_user_filter(user_id))
    )
    return db.execute(stmt).scalar_one()


def is_project_visible_to_user(db: Session, project: Project, user_id: int) -> bool:
    if project.owner_id == user_id:
        return True
    membership = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id,
        )
    ).scalar_one_or_none()
    return membership is not None


def get_project_task_counts(db: Session, project_id: int) -> tuple[int, int]:
    total = db.execute(
        select(func.count(Task.id)).where(Task.project_id == project_id)
    ).scalar_one()
    completed = db.execute(
        select(func.count(Task.id)).where(
            Task.project_id == project_id, Task.status == TaskStatus.DONE
        )
    ).scalar_one()
    return total, completed


def slug_exists(db: Session, slug: str) -> bool:
    return get_project_by_slug(db, slug) is not None


def list_public_projects(db: Session) -> list[Project]:
    stmt = (
        select(Project)
        .where(Project.is_public.is_(True))
        .order_by(Project.updated_at.desc())
    )
    return list(db.execute(stmt).scalars().all())
