from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.dataset import DatasetConfig, build_training_matrices
from app.ml.features import feature_names
from app.ml.metrics import evaluate_binary
from app.ml.model import EnsembleArtifact
from app.ml.registry import ModelMetadata, save_artifact, utc_version


@dataclass(frozen=True)
class TrainConfig:
    test_size: float = 0.2
    random_state: int = 42

    # Logistic regression
    lr_c: float = 1.0


def train_from_dataframe(
    df: pd.DataFrame,
    *,
    dataset_cfg: DatasetConfig | None = None,
    train_cfg: TrainConfig | None = None,
    notes: str = "",
) -> tuple[str, ModelMetadata]:
    dataset_cfg = dataset_cfg or DatasetConfig()
    train_cfg = train_cfg or TrainConfig()

    x, y = build_training_matrices(df, cfg=dataset_cfg)

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=train_cfg.test_size,
        random_state=train_cfg.random_state,
        stratify=y if len(np.unique(y)) > 1 else None,
    )

    lr = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "clf",
                LogisticRegression(
                    C=train_cfg.lr_c,
                    max_iter=2000,
                    solver="lbfgs",
                ),
            ),
        ]
    )

    lr.fit(x_train, y_train)
    artifact = EnsembleArtifact(logistic=lr, lgbm=None, feature_names=feature_names())

    proba = artifact.predict_proba(x_test)
    metrics = evaluate_binary(y_test, proba)

    version = utc_version()
    metadata = ModelMetadata(
        version=version,
        created_at=version,
        metrics=metrics,
        feature_names=artifact.feature_names,
        notes=notes,
    )

    save_artifact(version=version, artifact=artifact, metadata=metadata)
    return version, metadata
