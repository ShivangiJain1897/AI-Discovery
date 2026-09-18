"""Health and diagnostics.

Reports which providers are actually in use, including the automatic fallback
to the deterministic provider, so "why does this say Not established?" has a
visible answer.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.config import settings
from app.domain.api import HealthOut
from app.prompts import get_prompt_library
from app.routers.deps import get_db

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(session: Session = Depends(get_db)) -> HealthOut:
    database = {"status": "ok", "url": settings.database_url.split("@")[-1]}
    try:
        session.execute(text("SELECT 1"))
        has_vector = session.execute(
            text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        ).first()
        database["pgvector"] = bool(has_vector)
    except Exception as exc:
        database = {"status": "error", "detail": str(exc)[:300]}

    library = get_prompt_library()
    llm_configured = settings.llm_provider
    llm_effective = settings.effective_llm_provider

    return HealthOut(
        status="ok" if database.get("status") == "ok" else "degraded",
        version=__version__,
        database=database,
        llm={
            "configured": llm_configured,
            "effective": llm_effective,
            "model": settings.anthropic_model if llm_effective == "anthropic" else "deterministic",
            "live": settings.is_live_ai,
            "note": (
                None
                if settings.is_live_ai
                else "No ANTHROPIC_API_KEY is set, so the deterministic provider is "
                "running. Synthesis and analysis will report 'Not established' "
                "rather than generating content."
            ),
        },
        search={
            "configured": settings.search_provider,
            "effective": settings.effective_search_provider,
            "live": settings.effective_search_provider != "mock",
        },
        embeddings={
            "configured": settings.embedding_provider,
            "effective": settings.effective_embedding_provider,
            "dimension": settings.embedding_dimension,
        },
        prompts={
            "count": len(library.all()),
            "directory": str(library.directory),
            "stages": {k: len(v) for k, v in library.by_stage().items()},
        },
        safety={
            "phi_detection": settings.phi_detection_enabled,
            "on_detect": settings.phi_on_detect,
            "audit_log": settings.audit_log_enabled,
            "retention_days": settings.data_retention_days,
        },
    )
