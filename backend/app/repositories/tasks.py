"""Focused query operations for the Task resource."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Task


def get_task_by_id_and_project(
    db: Session, project_id: int, task_id: int
) -> Task | None:
    return db.execute(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    ).scalar_one_or_none()


def list_tasks_for_project(db: Session, project_id: int) -> list[Task]:
    return list(
        db.execute(select(Task).where(Task.project_id == project_id)).scalars().all()
    )
