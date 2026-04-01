from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Health check")
async def health_check() -> dict:
    return {"status": "ok", "service": "edupredict-backend"}


@router.get("/ready", summary="Readiness check")
async def readiness_check(db: AsyncSession = Depends(get_db_session)) -> dict:
    try:
        await db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable",
        ) from exc

    return {"status": "ready"}
