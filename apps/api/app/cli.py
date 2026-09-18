"""Command-line utilities: migrate, seed, reset."""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import text

from app.db import models  # noqa: F401 - registers the mapped classes
from app.db.base import Base, SessionLocal, engine


def migrate() -> None:
    """Create tables and required extensions."""
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    Base.metadata.create_all(engine)
    print(f"Created {len(Base.metadata.tables)} tables.")


def drop() -> None:
    Base.metadata.drop_all(engine)
    print("Dropped all tables.")


def seed() -> None:
    from app.seed.medicaid import seed_project

    session = SessionLocal()
    try:
        project = seed_project(session)
        session.commit()
        print(f"Seeded project: {project.title}")
        print(f"  id       {project.id}")
        print(f"  evidence {len(project.evidence)} items")
        print(f"  findings {len(project.findings)}")
        print(f"  open at  http://localhost:3000/projects/{project.id}")
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(prog="discovery", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("migrate", help="Create tables and extensions")
    sub.add_parser("drop", help="Drop all tables")
    sub.add_parser("seed", help="Load the sample discovery project")
    reset = sub.add_parser("reset", help="Drop, recreate, and optionally seed")
    reset.add_argument("--seed", action="store_true", help="Seed after resetting")

    args = parser.parse_args()
    if args.command == "migrate":
        migrate()
    elif args.command == "drop":
        drop()
    elif args.command == "seed":
        seed()
    elif args.command == "reset":
        drop()
        migrate()
        if args.seed:
            seed()
    return 0


if __name__ == "__main__":
    sys.exit(main())
