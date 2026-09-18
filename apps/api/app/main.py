"""FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.config import settings
from app.prompts import get_prompt_library
from app.routers import (
    analysis,
    artifacts,
    copilot,
    evidence,
    health,
    jobs,
    projects,
    prompts,
    research,
    synthesis,
    uploads,
)
from app.services.safety import PHIBlocked

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load and validate the prompt library at boot rather than on first
    # request, so a malformed prompt fails the deploy, not a user's research run.
    library = get_prompt_library()
    logger.info(
        "Prompt library: %d templates. LLM: %s. Search: %s.",
        len(library.all()),
        settings.effective_llm_provider,
        settings.effective_search_provider,
    )
    if not settings.is_live_ai:
        logger.warning(
            "No model credential configured — running the deterministic provider. "
            "Synthesis and analysis will report 'Not established'."
        )
    yield


app = FastAPI(
    title="AI Product Discovery Platform",
    description=(
        "Structured product discovery: research once, preserve the evidence, "
        "analyse it many ways, generate decision-ready artifacts."
    ),
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_base_url, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(PHIBlocked)
async def phi_blocked_handler(request: Request, exc: PHIBlocked) -> JSONResponse:
    """Surface a PHI block as a clear, actionable error."""
    return JSONResponse(
        status_code=422,
        content={
            "detail": str(exc),
            "identifiers": exc.result.kinds,
            "remedy": (
                "Remove the identifiers, or set PHI_ON_DETECT=redact to have them "
                "masked automatically before the request leaves this service."
            ),
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


for router in (
    health.router,
    projects.router,
    research.router,
    evidence.router,
    synthesis.router,
    analysis.router,
    artifacts.router,
    uploads.router,
    copilot.router,
    prompts.router,
    jobs.router,
):
    app.include_router(router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {
        "name": "AI Product Discovery Platform",
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
    }
