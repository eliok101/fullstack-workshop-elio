"""Task routes, nested under projects."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.models import TaskPriority, TaskStatus
from app.db.session import get_db
from app.schemas.tasks import TaskCreate, TaskRead, TaskUpdate
from app.services.tasks import (
    create_task,
    delete_task,
    get_task_or_404,
    list_tasks,
    update_task,
)

router = APIRouter(tags=["tasks"])

FAKE_CURRENT_USER_ID = 1  # temporary until Module 08 authentication - requires a user with this id to exist (see learning log, Module 07 Step 7)


@router.get("/projects/{project_id}/tasks", response_model=list[TaskRead])
def list_project_tasks(
    project_id: int,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    db: Session = Depends(get_db),
) -> list[TaskRead]:
    tasks = list_tasks(
        db, project_id, FAKE_CURRENT_USER_ID, status=status, priority=priority
    )
    return [TaskRead.model_validate(t) for t in tasks]


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_task(
    project_id: int, payload: TaskCreate, db: Session = Depends(get_db)
) -> TaskRead:
    task = create_task(
        db,
        project_id=project_id,
        user_id=FAKE_CURRENT_USER_ID,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        due_date=payload.due_date,
    )
    return TaskRead.model_validate(task)


@router.get("/projects/{project_id}/tasks/{task_id}", response_model=TaskRead)
def get_project_task(
    project_id: int, task_id: int, db: Session = Depends(get_db)
) -> TaskRead:
    task = get_task_or_404(db, project_id, task_id, FAKE_CURRENT_USER_ID)
    return TaskRead.model_validate(task)


@router.patch("/projects/{project_id}/tasks/{task_id}", response_model=TaskRead)
def patch_project_task(
    project_id: int, task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)
) -> TaskRead:
    update_data = payload.model_dump(exclude_unset=True)
    task = update_task(db, project_id, task_id, FAKE_CURRENT_USER_ID, update_data)
    return TaskRead.model_validate(task)


@router.delete(
    "/projects/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_project_task(
    project_id: int, task_id: int, db: Session = Depends(get_db)
) -> None:
    delete_task(db, project_id, task_id, FAKE_CURRENT_USER_ID)
