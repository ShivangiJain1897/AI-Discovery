"""Shared route dependencies."""

from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import get_session
from app.db.models import Project, Workspace

DEFAULT_WORKSPACE_SLUG = "default"


def get_db() -> Session:  # pragma: no cover - thin re-export for route signatures
    yield from get_session()


def get_workspace(session: Session = Depends(get_db)) -> Workspace:
    """Resolve the active workspace.

    Single-tenant for now. When an identity provider is wired in, this is the
    one place that changes — every query already scopes by the workspace this
    returns.
    """
    workspace = session.execute(
        select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
    ).scalar_one_or_none()
    if workspace is None:
        workspace = Workspace(name="Default Workspace", slug=DEFAULT_WORKSPACE_SLUG)
        session.add(workspace)
        session.flush()
    return workspace


def get_project(
    project_id: uuid.UUID,
    session: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
) -> Project:
    project = session.execute(
        select(Project).where(
            Project.id == project_id, Project.workspace_id == workspace.id
        )
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Project {project_id} not found")
    return project
