"""The stage runner.

Every agent in the system is the same three steps: render a prompt from the
library, send it to the configured provider, get back a validated contract.
Keeping that in one place means a stage is defined by its prompt and its
schema — not by bespoke plumbing — and means PHI screening, audit logging and
provider metrics apply uniformly rather than per call site.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import TypeVar

from pydantic import BaseModel

from app.llm import get_llm_provider
from app.prompts import get_prompt_library
from app.services import safety

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


@dataclass
class StageRun:
    """What a stage cost and what it flagged. Surfaced in the run record."""

    prompt_key: str
    prompt_version: str
    provider: str
    model: str
    duration_ms: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    warnings: list[str] = field(default_factory=list)
    phi_detected: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "prompt": f"{self.prompt_key}@{self.prompt_version}",
            "provider": self.provider,
            "model": self.model,
            "duration_ms": self.duration_ms,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "warnings": self.warnings,
            "phi_detected": self.phi_detected,
        }


def run_stage(
    prompt_key: str,
    inputs: dict,
    *,
    schema: type[T] | None = None,
    fast: bool = False,
    max_tokens: int | None = None,
) -> tuple[T, StageRun]:
    """Execute one pipeline stage and return its validated contract."""
    library = get_prompt_library()
    template = library.get(prompt_key)
    system, user, declared_schema = library.render(prompt_key, inputs)

    target = schema or declared_schema
    if target is None:
        raise ValueError(f"Prompt '{prompt_key}' declares no output schema")

    # Screen before the text leaves the process, not after.
    guarded_user, scan = safety.guard_outbound(user)
    if scan.found:
        logger.warning(
            "Identifiers detected in %s stage input: %s", prompt_key, ", ".join(scan.kinds)
        )

    provider = get_llm_provider()
    started = time.perf_counter()
    result_obj, meta = provider.complete_structured(
        system=system,
        user=guarded_user,
        schema=target,
        fast=fast,
        max_tokens=max_tokens,
        context=inputs,
    )
    duration = int((time.perf_counter() - started) * 1000)

    run = StageRun(
        prompt_key=prompt_key,
        prompt_version=template.version,
        provider=meta.provider,
        model=meta.model,
        duration_ms=duration,
        input_tokens=meta.input_tokens,
        output_tokens=meta.output_tokens,
        warnings=list(meta.warnings),
        phi_detected=scan.kinds,
    )
    logger.info(
        "stage=%s provider=%s model=%s ms=%d in=%d out=%d",
        prompt_key, meta.provider, meta.model, duration, meta.input_tokens, meta.output_tokens,
    )
    return result_obj, run
