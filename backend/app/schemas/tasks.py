"""Pydantic schemas for the Task resource."""
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.db.models import TaskPriority, TaskStatus


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: int | None = None
    due_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: int | None = None
    due_date: date | None = None


class TaskRead(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    assignee_id: int | None
    due_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
