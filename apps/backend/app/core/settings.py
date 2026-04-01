from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Load env from apps/backend/.env regardless of the process working directory.
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        env_prefix="",
        extra="ignore",
    )

    # Default to SQLite for local dev; override via DATABASE_URL for Postgres.
    database_url: str = "sqlite+aiosqlite:///./edupredict.db"
    # Override in apps/backend/.env (or real environment) for anything beyond local dev.
    jwt_secret: str = "dev-secret-change-me"
    jwt_issuer: str = "edupredict"
    refresh_token_expire_days: int = 14
    jwt_audience: str = "edupredict-web"
    access_token_expire_minutes: int = 30

    # Bootstrap (disabled by default). Used to create the first admin user safely.
    allow_admin_bootstrap: bool = False
    admin_bootstrap_token: str = ""

    # Runtime mode and production controls.
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = False
    app_log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    allowed_hosts: list[str] | str = ["localhost", "127.0.0.1"]

    # NOTE: pydantic-settings attempts to JSON-parse env values for complex types like list[str].
    # Accept str|list[str] so simple dotenv values like
    #   CORS_ALLOW_ORIGINS=http://localhost:3000,http://localhost:3001
    # don't raise SettingsError before validators run.
    cors_allow_origins: list[str] | str = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    # ML artifact registry
    model_registry_path: str = "ml_registry"

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _parse_cors_allow_origins(cls, v):
        # Accept either a JSON list or a comma-separated string.
        if isinstance(v, str):
            parts = [p.strip() for p in v.split(",")]
            return [p for p in parts if p]
        return v

    @field_validator("allowed_hosts", mode="before")
    @classmethod
    def _parse_allowed_hosts(cls, v):
        if isinstance(v, str):
            parts = [p.strip() for p in v.split(",")]
            return [p for p in parts if p]
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    def validate_runtime_config(self) -> None:
        if self.is_production:
            if self.jwt_secret == "dev-secret-change-me" or len(self.jwt_secret) < 32:
                raise ValueError("In production, JWT_SECRET must be set to a strong value (>=32 chars).")
            if not self.cors_allow_origins:
                raise ValueError("In production, CORS_ALLOW_ORIGINS must include at least one trusted origin.")
            if not self.allowed_hosts:
                raise ValueError("In production, ALLOWED_HOSTS must include at least one host.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
