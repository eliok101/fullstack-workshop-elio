"""Project-related service operations."""
from sqlalchemy.orm import Session

from app.db.models import Project, ProjectMember


def create_project_with_owner(
    db: Session, name: str, slug: str, owner_id: int, simulate_failure: bool = False
) -> Project:
    project = Project(name=name, slug=slug, owner_id=owner_id)
    db.add(project)
    db.flush()  # populate project.id without committing

    if simulate_failure:
        raise RuntimeError("simulated failure after project insert, before membership commit")

    membership = ProjectMember(project_id=project.id, user_id=owner_id, role="owner")
    db.add(membership)
    return project
