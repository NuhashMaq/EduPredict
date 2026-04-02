from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.settings import get_settings


@dataclass(frozen=True)
class ModelMetadata:
    version: str
    created_at: str
    metrics: dict[str, float]
    feature_names: list[str]
    notes: str = ""


def utc_version() -> str:
    # Example: 20260101_153012_123456Z
    # Include microseconds to avoid collisions when training multiple times in the same second.
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%fZ")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _backend_root() -> Path:
    # apps/backend/app/ml/registry.py -> parents[2] == apps/backend
    return Path(__file__).resolve().parents[2]


def registry_root(default: str = "ml_registry") -> Path:
    settings = get_settings()

    p = Path(os.getenv("MODEL_REGISTRY_PATH", settings.model_registry_path or default))
    if not p.is_absolute():
        p = _backend_root() / p
    return p.resolve()


def version_dir(version: str) -> Path:
    return registry_root() / "models" / version


def save_artifact(*, version: str, artifact: Any, metadata: ModelMetadata) -> Path:
    import joblib

    d = version_dir(version)
    ensure_dir(d)

    model_path = d / "model.joblib"
    meta_path = d / "metadata.json"

    joblib.dump(artifact, model_path)
    meta_path.write_text(json.dumps(asdict(metadata), indent=2), encoding="utf-8")

    # Update pointer to latest.
    latest_path = registry_root() / "LATEST"
    ensure_dir(latest_path.parent)
    latest_path.write_text(version, encoding="utf-8")

    return model_path


def load_metadata(version: str) -> ModelMetadata:
    meta_path = version_dir(version) / "metadata.json"
    data = json.loads(meta_path.read_text(encoding="utf-8"))
    return ModelMetadata(**data)


def latest_version() -> str | None:
    p = registry_root() / "LATEST"
    if not p.exists():
        return None
    v = p.read_text(encoding="utf-8").strip()
    return v or None


def set_latest_version(version: str) -> None:
    """Promote a specific version to be the registry 'latest' pointer."""
    # Ensure the version exists and has metadata.
    meta_path = version_dir(version) / "metadata.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"Model version not found: {version}")

    latest_path = registry_root() / "LATEST"
    ensure_dir(latest_path.parent)
    latest_path.write_text(version, encoding="utf-8")


def list_versions(*, limit: int = 200) -> list[str]:
    """List available model versions in descending order (newest first)."""
    root = registry_root() / "models"
    if not root.exists():
        return []

    versions: list[str] = []
    for p in root.iterdir():
        if not p.is_dir():
            continue
        # Only include directories that look like model artifacts.
        if (p / "metadata.json").exists():
            versions.append(p.name)

    versions.sort(reverse=True)
    return versions[: max(0, int(limit))]


def load_latest_artifact() -> Any:
    import joblib

    v = latest_version()
    if not v:
        raise FileNotFoundError("No model available in registry")
    return joblib.load(version_dir(v) / "model.joblib")
