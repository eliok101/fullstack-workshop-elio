"""Exhaustive unit tests for the task status transition rule - no database involved."""
import pytest

from app.db.models import TaskStatus
from app.services.task_transitions import is_transition_allowed


@pytest.mark.parametrize(
    "current,requested,expected",
    [
        (TaskStatus.BACKLOG, TaskStatus.BACKLOG, True),
        (TaskStatus.BACKLOG, TaskStatus.IN_PROGRESS, True),
        (TaskStatus.BACKLOG, TaskStatus.DONE, False),
        (TaskStatus.IN_PROGRESS, TaskStatus.BACKLOG, False),
        (TaskStatus.IN_PROGRESS, TaskStatus.IN_PROGRESS, True),
        (TaskStatus.IN_PROGRESS, TaskStatus.DONE, True),
        (TaskStatus.DONE, TaskStatus.BACKLOG, False),
        (TaskStatus.DONE, TaskStatus.IN_PROGRESS, False),
        (TaskStatus.DONE, TaskStatus.DONE, True),
    ],
)
def test_transition_matrix(current, requested, expected):
    assert is_transition_allowed(current, requested) is expected
