"""Per-project human-readable reference allocation.

Every project-scoped record gets a short id — ``E-014``, ``F-003``, ``O-002``.
Those refs are what an artifact cites, what the UI renders as a clickable chip,
and what survives into an exported document, so they must be stable, readable
and unique within a project.

Counters live on the project row and are allocated under a row lock, so two
concurrent research runs cannot mint the same ref.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Project

PREFIXES = {
    "evidence": "E",
    "source": "S",
    "theme": "T",
    "finding": "F",
    "insight": "I",
    "analysis": "A",
    "opportunity": "O",
    "recommendation": "R",
    "use_case": "UC",
    "artifact": "ART",
    "research_plan": "RP",
    "research_question": "RQ",
    "research_run": "RUN",
    "synthesis": "SYN",
    "document": "DOC",
}


def allocate(session: Session, project_id, entity: str, count: int = 1) -> list[str]:
    """Reserve `count` refs for an entity type and return them in order."""
    if entity not in PREFIXES:
        raise ValueError(f"No ref prefix registered for entity '{entity}'")

    project = session.execute(
        select(Project).where(Project.id == project_id).with_for_update()
    ).scalar_one()

    counters = dict(project.ref_counters or {})
    start = int(counters.get(entity, 0))
    counters[entity] = start + count
    project.ref_counters = counters
    session.flush()

    prefix = PREFIXES[entity]
    width = 3 if prefix not in ("ART", "RUN", "SYN", "DOC") else 2
    return [f"{prefix}-{str(start + n).zfill(width)}" for n in range(1, count + 1)]


def allocate_one(session: Session, project_id, entity: str) -> str:
    return allocate(session, project_id, entity, 1)[0]
