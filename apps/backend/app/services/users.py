from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole


class UsersService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> User | None:
        res = await self.session.execute(select(User).where(User.email == email))
        return res.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID | str) -> User | None:
        if isinstance(user_id, str):
            try:
                user_id = uuid.UUID(user_id)
            except ValueError:
                return None
        res = await self.session.execute(select(User).where(User.id == user_id))
        return res.scalar_one_or_none()

    async def create_user(
        self,
        *,
        email: str,
        full_name: str,
        role: UserRole,
        password: str,
        is_active: bool = True,
    ) -> User:
        user = User(
            email=email.lower().strip(),
            full_name=full_name.strip(),
            role=role,
            password_hash=hash_password(password),
            is_active=is_active,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def list_users(self, *, limit: int = 50, offset: int = 0) -> tuple[list[User], int]:
        q = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
        cq = select(func.count(User.id))

        items_res = await self.session.execute(q)
        count_res = await self.session.execute(cq)
        return list(items_res.scalars().all()), int(count_res.scalar_one())

    async def list_users_filtered(
        self,
        *,
        role: UserRole | None = None,
        q: str | None = None,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        query = select(User)
        count_query = select(func.count(User.id))

        if role is not None:
            query = query.where(User.role == role)
            count_query = count_query.where(User.role == role)

        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)

        if q:
            like = f"%{q.strip().lower()}%"
            filt = or_(func.lower(User.email).like(like), func.lower(User.full_name).like(like))
            query = query.where(filt)
            count_query = count_query.where(filt)

        query = query.order_by(User.created_at.desc()).limit(limit).offset(offset)

        items_res = await self.session.execute(query)
        count_res = await self.session.execute(count_query)
        return list(items_res.scalars().all()), int(count_res.scalar_one())

    async def update_user(self, user: User, patch: dict) -> User:
        for k, v in patch.items():
            setattr(user, k, v)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def delete_user(self, user: User) -> None:
        await self.session.delete(user)
        await self.session.commit()
