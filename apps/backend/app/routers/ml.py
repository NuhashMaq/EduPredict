from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.deps.auth import get_current_user, require_roles
from app.ml.humanize import human_label, human_unit
from app.ml.registry import load_metadata
from app.models.academic_record import AcademicRecord
from app.models.user import User, UserRole
from app.schemas.ml import (
    ExplainRequest,
    ExplainResponse,
    FactorPublic,
    ModelInfo,
    ModelListResponse,
    PromoteResponse,
    PredictionRequest,
    PredictionResponse,
    TrainRequest,
    TrainResponse,
)

router = APIRouter(prefix="/ml", tags=["ml"])


def _ml_dependency_unavailable(exc: ModuleNotFoundError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "ML dependencies are not available in this deployment "
            f"(missing module: {exc.name}). Install backend ML packages and redeploy."
        ),
    )


async def _get_record(
    session: AsyncSession,
    *,
    record_id: uuid.UUID,
) -> AcademicRecord | None:
    res = await session.execute(select(AcademicRecord).where(AcademicRecord.id == record_id))
    return res.scalar_one_or_none()


async def _get_latest_record_for_student(
    session: AsyncSession,
    *,
    student_user_id: uuid.UUID,
) -> AcademicRecord | None:
    q = (
        select(AcademicRecord)
        .where(AcademicRecord.student_user_id == student_user_id)
        .order_by(AcademicRecord.created_at.desc())
        .limit(1)
    )
    res = await session.execute(q)
    return res.scalar_one_or_none()


def _risk_label(p: float, threshold: float) -> str:
    return "At-Risk" if p >= threshold else "Not-At-Risk"


@router.post(
    "/predict",
    response_model=PredictionResponse,
)
async def predict(
    body: PredictionRequest,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> PredictionResponse:
    try:
        from app.ml.inference import df_from_features, df_from_record, predict_proba_from_raw_df
    except ModuleNotFoundError as exc:
        raise _ml_dependency_unavailable(exc)

    df_raw = None

    if body.features is not None:
        # Teachers/Admins only (to avoid students self-tweaking inputs to "game" the model).
        if user.role not in (UserRole.teacher, UserRole.admin):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        df_raw = df_from_features(**body.features.model_dump())

    elif body.academic_record_id is not None:
        record = await _get_record(session, record_id=body.academic_record_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic record not found")

        # Students can only predict for their own record.
        if user.role == UserRole.student and record.student_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        df_raw = df_from_record(record)

    else:
        # student_user_id path -> pick latest record
        target_student_id = body.student_user_id
        if target_student_id is None:
            # If caller is a student, default to self.
            target_student_id = user.id

        if user.role == UserRole.student and target_student_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        if user.role not in (UserRole.student, UserRole.teacher, UserRole.admin):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        record = await _get_latest_record_for_student(session, student_user_id=target_student_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No academic record found")
        df_raw = df_from_record(record)

    p, version = predict_proba_from_raw_df(df_raw)

    return PredictionResponse(
        classification=_risk_label(p, body.threshold),
        risk_probability=float(p),
        confidence=float(max(p, 1.0 - p)),
        threshold=float(body.threshold),
        model_version=version,
    )


@router.post("/explain", response_model=ExplainResponse)
async def explain(
    body: ExplainRequest,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> ExplainResponse:
    try:
        from app.ml.inference import df_from_features, df_from_record, explain_from_raw_df
    except ModuleNotFoundError as exc:
        raise _ml_dependency_unavailable(exc)

    df_raw = None

    if body.features is not None:
        if user.role not in (UserRole.teacher, UserRole.admin):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        df_raw = df_from_features(**body.features.model_dump())

    elif body.academic_record_id is not None:
        record = await _get_record(session, record_id=body.academic_record_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic record not found")

        if user.role == UserRole.student and record.student_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        df_raw = df_from_record(record)

    else:
        target_student_id = body.student_user_id
        if target_student_id is None:
            target_student_id = user.id

        if user.role == UserRole.student and target_student_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        if user.role not in (UserRole.student, UserRole.teacher, UserRole.admin):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        record = await _get_latest_record_for_student(session, student_user_id=target_student_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No academic record found")
        df_raw = df_from_record(record)

    factors, version = explain_from_raw_df(df_raw, top_k=body.top_k)

    out = [
        FactorPublic(
            feature_key=f.feature,
            feature_label=human_label(f.feature),
            value=float(f.value),
            impact=float(f.impact),
            direction=f.direction,
            unit=human_unit(f.feature),
        )
        for f in factors
    ]

    return ExplainResponse(model_version=version, factors=out)


@router.get(
    "/model",
    response_model=ModelInfo,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def model_info() -> ModelInfo:
    # Reads metadata for latest model.
    from app.ml.registry import latest_version

    v = latest_version()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No model registered")

    meta = load_metadata(v)
    return ModelInfo(
        model_version=meta.version,
        created_at=meta.created_at,
        metrics=meta.metrics,
        feature_names=meta.feature_names,
        notes=meta.notes,
    )


@router.get(
    "/models",
    response_model=ModelListResponse,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def list_models(limit: int = 200) -> ModelListResponse:
    from app.ml.registry import latest_version, list_versions

    latest = latest_version()
    versions = list_versions(limit=limit)

    items: list[ModelInfo] = []
    for v in versions:
        try:
            meta = load_metadata(v)
        except Exception:
            # Skip unreadable/corrupted entries rather than failing the whole endpoint.
            continue
        items.append(
            ModelInfo(
                model_version=meta.version,
                created_at=meta.created_at,
                metrics=meta.metrics,
                feature_names=meta.feature_names,
                notes=meta.notes,
            )
        )

    return ModelListResponse(latest_version=latest, items=items)


@router.post(
    "/models/{model_version}/promote",
    response_model=PromoteResponse,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def promote_model(model_version: str) -> PromoteResponse:
    from app.ml.registry import set_latest_version

    try:
        # Validate existence by reading metadata first.
        meta = load_metadata(model_version)
        set_latest_version(model_version)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model version not found")

    model = ModelInfo(
        model_version=meta.version,
        created_at=meta.created_at,
        metrics=meta.metrics,
        feature_names=meta.feature_names,
        notes=meta.notes,
    )
    return PromoteResponse(latest_version=model_version, model=model)


@router.post(
    "/train",
    response_model=TrainResponse,
    dependencies=[Depends(require_roles(UserRole.admin))],
)
async def train_model(
    body: TrainRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TrainResponse:
    """Train a new model from the academic_records table.

    This is a synchronous training endpoint intended for admin use.
    For production, you'd typically offload this to a job queue.
    """

    res = await session.execute(
        select(
            AcademicRecord.attendance_pct,
            AcademicRecord.assignments_pct,
            AcademicRecord.quizzes_pct,
            AcademicRecord.exams_pct,
            AcademicRecord.gpa,
        )
    )
    rows = res.all()

    if len(rows) < body.min_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough academic records to train (have {len(rows)}, need {body.min_rows})",
        )

    try:
        import pandas as pd
        from app.ml.train import train_from_dataframe
    except ModuleNotFoundError as exc:
        raise _ml_dependency_unavailable(exc)

    df = pd.DataFrame(rows, columns=["attendance_pct", "assignments_pct", "quizzes_pct", "exams_pct", "gpa"])

    version, meta = train_from_dataframe(df, notes=body.notes)

    model = ModelInfo(
        model_version=version,
        created_at=meta.created_at,
        metrics=meta.metrics,
        feature_names=meta.feature_names,
        notes=meta.notes,
    )
    return TrainResponse(trained=True, model=model)
