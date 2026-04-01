from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class AdminBootstrapRequest(BaseModel):
    bootstrap_token: str = Field(min_length=10)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(default="", max_length=160)


class AdminBootstrapResponse(BaseModel):
    created: bool
    role: UserRole


class ImportRowError(BaseModel):
    row: int
    message: str


class ImportStudentsResponse(BaseModel):
    created: int
    updated_existing: int = 0
    skipped_existing: int
    invalid_rows: int
    errors: list[ImportRowError] = []
