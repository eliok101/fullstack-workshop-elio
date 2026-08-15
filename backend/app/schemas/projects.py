"""Pydantic schemas for the Project resource."""

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    is_public: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    is_public: bool | None = None


class ProjectRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    is_public: bool
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectPublicSummary(BaseModel):
    name: str
    slug: str
    description: str | None
    task_count: int
    completed_task_count: int


class ProjectPublicListItem(BaseModel):
    """Deliberately narrower than ProjectPublicSummary: a sitemap only needs
    the URL and a freshness signal, not description/task counts."""

    slug: str
    updated_at: datetime
