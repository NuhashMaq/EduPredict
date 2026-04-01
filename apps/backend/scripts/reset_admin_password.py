from __future__ import annotations

import argparse
import sqlite3
import uuid
from pathlib import Path

from app.core.security import hash_password


def backend_root() -> Path:
    # apps/backend/scripts/reset_admin_password.py -> parents[1] == apps/backend
    return Path(__file__).resolve().parents[1]


def db_path() -> Path:
    # Keep consistent with local dev defaults.
    return backend_root() / "edupredict.db"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Reset (or create) the admin user in the local SQLite database used by the backend. "
            "This is intended for local development only."
        )
    )
    parser.add_argument("--email", default="admin@example.com")
    parser.add_argument("--password", default="admin@123")
    args = parser.parse_args()

    p = db_path()
    if not p.exists():
        raise SystemExit(f"Database not found: {p}")

    con = sqlite3.connect(str(p))
    try:
        con.execute("BEGIN")

        row = con.execute(
            "SELECT id FROM users WHERE email = ?",
            (args.email,),
        ).fetchone()

        pw_hash = hash_password(args.password)

        if row:
            con.execute(
                "UPDATE users SET password_hash = ?, is_active = 1, role = 'admin' WHERE email = ?",
                (pw_hash, args.email),
            )
            print(f"Updated password for {args.email}")
        else:
            user_id = uuid.uuid4().hex
            con.execute(
                "INSERT INTO users (id, email, full_name, role, password_hash, is_active) VALUES (?, ?, ?, ?, ?, 1)",
                (user_id, args.email, "", "admin", pw_hash),
            )
            print(f"Created admin user {args.email} (id={user_id})")

        con.commit()
        return 0
    finally:
        con.close()


if __name__ == "__main__":
    raise SystemExit(main())
