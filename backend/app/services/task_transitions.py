"""Pure function governing allowed task status transitions."""
from app.db.models import TaskStatus

ALLOWED_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.BACKLOG: {TaskStatus.BACKLOG, TaskStatus.IN_PROGRESS},
    TaskStatus.IN_PROGRESS: {TaskStatus.IN_PROGRESS, TaskStatus.DONE},
    TaskStatus.DONE: {TaskStatus.DONE},
}


def is_transition_allowed(current: TaskStatus, requested: TaskStatus) -> bool:
    return requested in ALLOWED_TRANSITIONS[current]
