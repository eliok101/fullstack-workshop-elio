"""Task-related service operations."""

from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.core.exceptions import InvalidTransitionError, NotFoundError
from app.db.models import Task, TaskPriority
from app.repositories.tasks import get_task_by_id_and_project, list_tasks_for_project
from app.services.projects import get_visible_project_or_404
from app.services.task_transitions import is_transition_allowed


def create_task(
    db: Session,
    project_id: int,
    user_id: int,
    title: str,
    description: str | None,
    priority: TaskPriority,
    assignee_id: int | None,
    due_date: date | None,
) -> Task:
    get_visible_project_or_404(db, project_id, user_id)  # step 1: verify project access

    task = Task(
        project_id=project_id,
        title=title,
        description=description,
        priority=priority,
        assignee_id=assignee_id,
        due_date=due_date,
    )
    db.add(task)
    db.flush()
    return task


def list_tasks(db: Session, project_id: int, user_id: int) -> list[Task]:
    get_visible_project_or_404(db, project_id, user_id)  # step 1: verify project access
    return list_tasks_for_project(db, project_id)


def get_task_or_404(db: Session, project_id: int, task_id: int, user_id: int) -> Task:
    get_visible_project_or_404(db, project_id, user_id)  # step 1: verify project access
    task = get_task_by_id_and_project(
        db, project_id, task_id
    )  # step 2: task belongs to project
    if task is None:
        raise NotFoundError(f"Task {task_id} not found in project {project_id}")
    return task


def update_task(
    db: Session,
    project_id: int,
    task_id: int,
    user_id: int,
    update_data: dict[str, Any],
) -> Task:
    task = get_task_or_404(db, project_id, task_id, user_id)  # steps 1 and 2

    if "status" in update_data:  # step 3: business validation
        requested_status = update_data["status"]
        if not is_transition_allowed(task.status, requested_status):
            raise InvalidTransitionError(
                f"Cannot transition task {task_id} from {task.status.value} "
                f"to {requested_status.value}"
            )

    for field, value in update_data.items():
        setattr(task, field, value)
    db.flush()  # step 4: persist once
    return task  # step 5: return the updated entity


def delete_task(db: Session, project_id: int, task_id: int, user_id: int) -> None:
    task = get_task_or_404(db, project_id, task_id, user_id)  # steps 1 and 2
    db.delete(task)  # step 4: persist once
