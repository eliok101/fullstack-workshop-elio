from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEMO_SECRET_KEY = "insecure-development-only-key-change-me"


class Settings(BaseSettings):
    app_name: str = "Workboard API"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"

    database_url: str = (
        "postgresql+psycopg://workboard:workboard-local-only@db:5432/workboard"
    )

    cors_origins: list[str] = ["http://localhost:3000"]

    secret_key: str = DEMO_SECRET_KEY
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_cookie_name: str = "refresh_token"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def guard_production_secret(self) -> "Settings":
        if self.environment == "production" and self.secret_key == DEMO_SECRET_KEY:
            raise ValueError(
                "Refusing to start: production environment is using the "
                "known demonstration secret_key. Set a real SECRET_KEY "
                "environment variable."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
