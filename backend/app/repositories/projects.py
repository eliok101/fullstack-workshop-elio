"""Focused query operations for the Project resource."""
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Project, ProjectMember, Task, TaskStatus, User


def get_project_by_id(db: Session, project_id: int) -> Project | None:
    return db.get(Project, project_id)


def get_project_by_slug(db: Session, slug: str) -> Project | None:
    return db.execute(
        select(Project).where(Project.slug == slug)
    ).scalar_one_or_none()


def list_projects_visible_to_user(db: Session, user_id: int) -> list[Project]:
    stmt = (
        select(Project)
        .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            or_(
                Project.owner_id == user_id,
                ProjectMember.user_id == user_id,
            )
        )
        .distinct()
    )
    return list(db.execute(stmt).scalars().all())


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


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()
