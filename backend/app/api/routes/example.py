"""Example schema-backed route (temporary, for Module 05 exercise purposes)."""

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.core.exceptions import NotFoundError

router = APIRouter(tags=["example"])


class EchoRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class EchoResponse(BaseModel):
    message: str


@router.post("/echo", response_model=EchoResponse, status_code=status.HTTP_200_OK)
def echo(payload: EchoRequest) -> EchoResponse:
    if payload.name.lower() == "missing":
        raise NotFoundError(f"Resource named '{payload.name}' does not exist")
    return EchoResponse(message=f"Hello, {payload.name}!")
