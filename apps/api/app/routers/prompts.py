"""Prompt library browsing.

Read-only over HTTP: prompts are version-controlled files under review in git,
not runtime configuration. The screen exists so a product manager can see
exactly what each stage was told to do.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.domain.api import PromptOut
from app.prompts import get_prompt_library

router = APIRouter(prefix="/prompts", tags=["prompts"])


def _out(template) -> PromptOut:
    return PromptOut(
        key=template.key,
        name=template.name,
        stage=template.stage,
        version=template.version,
        purpose=template.purpose,
        inputs=template.inputs,
        output_schema=template.output_schema,
        guardrails=template.guardrails,
        instructions=template.instructions,
        checksum=template.checksum,
    )


@router.get("", response_model=list[PromptOut])
def list_prompts() -> list[PromptOut]:
    return [_out(t) for t in get_prompt_library().all()]


@router.get("/stages")
def list_stages() -> dict[str, list[dict]]:
    return {
        stage: [{"key": t.key, "name": t.name, "version": t.version} for t in templates]
        for stage, templates in get_prompt_library().by_stage().items()
    }


@router.get("/{key}", response_model=PromptOut)
def get_prompt(key: str) -> PromptOut:
    try:
        return _out(get_prompt_library().get(key))
    except KeyError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
