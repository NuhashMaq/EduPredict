from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.ml.model import EnsembleArtifact


@dataclass(frozen=True)
class FactorContribution:
    feature: str
    value: float
    impact: float
    direction: str  # "increases_risk" | "decreases_risk"


def explain_with_shap_tree(
    artifact: EnsembleArtifact,
    x_row: pd.DataFrame,
    *,
    top_k: int = 5,
) -> list[FactorContribution]:
    """Return top-k local feature impacts using finite-difference sensitivity.

    This method avoids heavyweight SHAP runtime dependencies while still producing
    directional feature attributions for dashboard explanations.
    """

    x_row = x_row[artifact.feature_names]
    base_p = float(np.asarray(artifact.predict_proba(x_row)).reshape(-1)[0])

    values = x_row.iloc[0].to_dict()

    # Domain-aware perturbation sizes for stable, interpretable local sensitivity.
    steps = {
        "attendance_pct": 5.0,
        "assignments_pct": 5.0,
        "quizzes_pct": 5.0,
        "exams_pct": 5.0,
        "gpa": 0.2,
    }
    bounds = {
        "attendance_pct": (0.0, 100.0),
        "assignments_pct": (0.0, 100.0),
        "quizzes_pct": (0.0, 100.0),
        "exams_pct": (0.0, 100.0),
        "gpa": (0.0, 4.0),
    }

    pairs = []
    for feat in artifact.feature_names:
        val = float(values[feat])
        lo, hi = bounds.get(feat, (-np.inf, np.inf))
        step = float(steps.get(feat, 1.0))

        up = min(hi, val + step)
        down = max(lo, val - step)

        x_up = x_row.copy()
        x_down = x_row.copy()
        x_up.at[x_up.index[0], feat] = up
        x_down.at[x_down.index[0], feat] = down

        p_up = float(np.asarray(artifact.predict_proba(x_up)).reshape(-1)[0])
        p_down = float(np.asarray(artifact.predict_proba(x_down)).reshape(-1)[0])

        # Positive impact means increasing this feature tends to increase risk locally.
        slope = (p_up - p_down) / max(up - down, 1e-9)
        impact = float(slope * step)

        pairs.append(
            FactorContribution(
                feature=feat,
                value=val,
                impact=impact,
                direction="increases_risk" if impact >= 0 else "decreases_risk",
            )
        )

    # Keep the global baseline available for debugging/inspection if needed.
    _ = base_p

    pairs.sort(key=lambda p: abs(p.impact), reverse=True)
    return pairs[: max(1, top_k)]
