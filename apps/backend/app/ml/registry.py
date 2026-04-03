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


def _configured_registry_path(default: str = "ml_registry") -> Path:
    settings = get_settings()
    return Path(os.getenv("MODEL_REGISTRY_PATH", settings.model_registry_path or default))


def registry_write_root(default: str = "ml_registry") -> Path:
    p = _configured_registry_path(default)
    if not p.is_absolute():
        # Vercel serverless filesystem is read-only under /var/task; /tmp is writable.
        if os.getenv("VERCEL_URL"):
            p = Path("/tmp") / p
        else:
            p = _backend_root() / p
    return p.resolve()


def registry_read_roots(default: str = "ml_registry") -> list[Path]:
    roots = [registry_write_root(default), (_backend_root() / default).resolve()]
    unique: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        key = str(root)
        if key in seen:
            continue
        seen.add(key)
        unique.append(root)
    return unique


def registry_root(default: str = "ml_registry") -> Path:
    # Backward-compat alias for callers expecting a single root.
    return registry_write_root(default)


def _model_dir(root: Path, version: str) -> Path:
    return root / "models" / version


def _read_latest_from_root(root: Path) -> str | None:
    p = root / "LATEST"
    if not p.exists():
        return None
    v = p.read_text(encoding="utf-8").strip()
    return v or None


def _find_version_dir(version: str) -> Path:
    for root in registry_read_roots():
        d = _model_dir(root, version)
        if (d / "metadata.json").exists():
            return d
    # Prefer writable root path in error messages.
    return _model_dir(registry_write_root(), version)


def version_dir(version: str) -> Path:
    # Keep original helper semantics for write workflows.
    return _model_dir(registry_write_root(), version)


def save_artifact(*, version: str, artifact: Any, metadata: ModelMetadata) -> Path:
    import joblib

    d = _model_dir(registry_write_root(), version)
    ensure_dir(d)

    model_path = d / "model.joblib"
    meta_path = d / "metadata.json"

    joblib.dump(artifact, model_path)
    meta_path.write_text(json.dumps(asdict(metadata), indent=2), encoding="utf-8")

    # Update pointer to latest in writable root.
    latest_path = registry_write_root() / "LATEST"
    ensure_dir(latest_path.parent)
    latest_path.write_text(version, encoding="utf-8")

    return model_path


def load_metadata(version: str) -> ModelMetadata:
    meta_path = _find_version_dir(version) / "metadata.json"
    data = json.loads(meta_path.read_text(encoding="utf-8"))
    return ModelMetadata(**data)


def latest_version() -> str | None:
    for root in registry_read_roots():
        v = _read_latest_from_root(root)
        if v:
            return v
    return None


def set_latest_version(version: str) -> None:
    """Promote a specific version to be the registry 'latest' pointer."""
    # Ensure the version exists and has metadata in either readable root.
    meta_path = _find_version_dir(version) / "metadata.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"Model version not found: {version}")

    latest_path = registry_write_root() / "LATEST"
    ensure_dir(latest_path.parent)
    latest_path.write_text(version, encoding="utf-8")


def list_versions(*, limit: int = 200) -> list[str]:
    """List available model versions in descending order (newest first)."""
    versions: set[str] = set()
    for root in registry_read_roots():
        models_root = root / "models"
        if not models_root.exists():
            continue
        for p in models_root.iterdir():
            if p.is_dir() and (p / "metadata.json").exists():
                versions.add(p.name)

    ordered = sorted(versions, reverse=True)
    return ordered[: max(0, int(limit))]


def load_latest_artifact() -> Any:
    import joblib

    v = latest_version()
    if not v:
        raise FileNotFoundError("No model available in registry")

    model_path = _find_version_dir(v) / "model.joblib"
    return joblib.load(model_path)
