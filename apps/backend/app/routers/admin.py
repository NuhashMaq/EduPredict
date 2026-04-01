from __future__ import annotations

import csv
import io
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.core.security import hash_password
from app.deps.auth import require_roles
from app.models.user import User, UserRole
from app.schemas.admin import ImportRowError, ImportStudentsResponse
from app.schemas.user import UserCreateAdmin, UserPublic, UserUpdateAdmin, UsersList
from app.services.users import UsersService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/users",
    response_model=UsersList,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def list_users(
    session: AsyncSession = Depends(get_db_session),
    role: UserRole | None = None,
    q: str | None = None,
    is_active: bool | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> UsersList:
    items, total = await UsersService(session).list_users_filtered(
        role=role,
        q=q,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )
    return UsersList(
        items=[UserPublic.model_validate(u, from_attributes=True) for u in items],
        total=total,
    )


@router.post(
    "/users",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def create_user_admin(
    body: UserCreateAdmin,
    session: AsyncSession = Depends(get_db_session),
) -> UserPublic:
    users = UsersService(session)
    existing = await users.get_by_email(body.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await users.create_user(
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        password=body.password,
    )
    return UserPublic.model_validate(user, from_attributes=True)


@router.patch(
    "/users/{user_id}",
    response_model=UserPublic,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def update_user_admin(
    user_id: uuid.UUID,
    body: UserUpdateAdmin,
    session: AsyncSession = Depends(get_db_session),
) -> UserPublic:
    users = UsersService(session)
    user = await users.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await users.update_user(user, patch)
    return UserPublic.model_validate(updated, from_attributes=True)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_user_admin(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: User = Depends(require_roles(UserRole.admin)),
) -> None:
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )

    users = UsersService(session)
    user = await users.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await users.delete_user(user)
    return None


@router.post(
    "/users/import-students",
    response_model=ImportStudentsResponse,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def import_students_csv(
    file: UploadFile = File(...),
    dry_run: bool = Form(default=False),
    update_existing: bool = Form(default=False),
    session: AsyncSession = Depends(get_db_session),
) -> ImportStudentsResponse:
    """Import student accounts from a CSV.

    Expected columns (extra columns are ignored):
      - email
      - full_name (optional)
      - password

    Notes:
    - Existing emails are skipped.
    - Passwords are stored hashed.
    """

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV missing header row")

    required = {"email", "password"}
    fields = {f.strip() for f in reader.fieldnames if f}
    if not required.issubset(fields):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must include headers: email, password (full_name optional)",
        )

    users = UsersService(session)

    created = 0
    updated_existing = 0
    skipped = 0
    invalid = 0
    errors: list[ImportRowError] = []

    row_num = 1  # header
    for row in reader:
        row_num += 1
        try:
            email = (row.get("email") or "").strip().lower()
            full_name = (row.get("full_name") or "").strip()
            password = (row.get("password") or "").strip()

            if not email:
                raise ValueError("Missing email")
            if not password:
                raise ValueError("Missing password")

            existing = await users.get_by_email(email)
            if existing:
                if not update_existing:
                    skipped += 1
                    continue

                # Only update student accounts; never clobber teacher/admin credentials.
                if existing.role != UserRole.student:
                    raise ValueError(f"Cannot update password for non-student user (role={existing.role.value})")

                if not dry_run:
                    existing.password_hash = hash_password(password)
                    if full_name:
                        existing.full_name = full_name
                    existing.is_active = True
                    await session.commit()

                updated_existing += 1
                continue

            if not dry_run:
                await users.create_user(
                    email=email,
                    full_name=full_name,
                    role=UserRole.student,
                    password=password,
                    is_active=True,
                )

            created += 1
        except Exception as e:
            invalid += 1
            if len(errors) < 50:
                errors.append(ImportRowError(row=row_num, message=str(e)))

    return ImportStudentsResponse(
        created=created,
        updated_existing=updated_existing,
        skipped_existing=skipped,
        invalid_rows=invalid,
        errors=errors,
    )
