from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class EnsembleArtifact:
    """Serializable artifact containing one or two calibrated models.

    - logistic: sklearn model implementing predict_proba
    - lgbm: optional secondary model implementing predict_proba
    """

    logistic: Any
    lgbm: Any | None
    feature_names: list[str]

    def predict_proba(self, x: pd.DataFrame) -> np.ndarray:
        x = x[self.feature_names]
        p1 = np.asarray(self.logistic.predict_proba(x))[:, 1]
        if self.lgbm is None:
            p = p1
        else:
            p2 = np.asarray(self.lgbm.predict_proba(x))[:, 1]
            p = 0.5 * p1 + 0.5 * p2
        return np.clip(p, 0.0, 1.0)

    def predict_label(self, x: pd.DataFrame, *, threshold: float = 0.5) -> np.ndarray:
        return (self.predict_proba(x) >= threshold).astype(int)
