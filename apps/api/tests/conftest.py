"""Test fixtures.

Tests run against the real Postgres schema rather than an in-memory stand-in,
because the model depends on Postgres-specific behaviour (JSONB, pgvector,
row-level locking for ref allocation) that SQLite would not exercise.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

os.environ.setdefault("LLM_PROVIDER", "mock")
os.environ.setdefault("SEARCH_PROVIDER", "mock")
os.environ.setdefault("EMBEDDING_PROVIDER", "mock")

from app.db import models  # noqa: E402,F401
from app.db.base import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def schema():
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def session():
    db = SessionLocal()
    try:
        yield db
        db.rollback()
    finally:
        db.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def seeded(session):
    """A fully populated project: context, plan, evidence, findings, artifacts."""
    from app.seed.medicaid import seed_project

    project = seed_project(session)
    session.commit()
    yield project
