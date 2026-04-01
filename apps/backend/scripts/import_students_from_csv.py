from __future__ import annotations

import argparse
import asyncio
import csv
from pathlib import Path

from app.core.db import get_sessionmaker
from app.models.user import UserRole
from app.services.users import UsersService


def _default_csv_path() -> Path:
    # scripts/import_students_from_csv.py -> parents[1] == apps/backend
    backend_root = Path(__file__).resolve().parents[1]
    return backend_root / "data" / "demo_ruet_cse" / "students_ruet_cse_50.csv"


async def import_students(csv_path: Path, *, dry_run: bool = False) -> tuple[int, int, int]:
    """Import student users from a CSV.

    Expected headers (extra columns are ignored):
      - email
      - full_name
      - password

    Returns: (created, skipped_existing, invalid_rows)
    """

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    SessionLocal = get_sessionmaker()

    created = 0
    skipped = 0
    invalid = 0

    async with SessionLocal() as session:
        users = UsersService(session)

        with csv_path.open("r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                email = (row.get("email") or "").strip().lower()
                full_name = (row.get("full_name") or "").strip()
                password = (row.get("password") or "").strip()

                if not email or not password:
                    invalid += 1
                    continue

                existing = await users.get_by_email(email)
                if existing:
                    skipped += 1
                    continue

                if dry_run:
                    created += 1
                    continue

                await users.create_user(
                    email=email,
                    full_name=full_name,
                    role=UserRole.student,
                    password=password,
                    is_active=True,
                )
                created += 1

    return created, skipped, invalid


def main() -> None:
    parser = argparse.ArgumentParser(description="Import student accounts from a CSV into the EduPredict database")
    parser.add_argument(
        "--csv",
        type=Path,
        default=_default_csv_path(),
        help="Path to students CSV (default: apps/backend/data/demo_ruet_cse/students_ruet_cse_50.csv)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and count imports without writing to the database",
    )

    args = parser.parse_args()

    created, skipped, invalid = asyncio.run(import_students(args.csv, dry_run=args.dry_run))
    mode = "DRY RUN" if args.dry_run else "IMPORTED"
    print(f"{mode}: created={created}, skipped_existing={skipped}, invalid_rows={invalid}")


if __name__ == "__main__":
    main()
