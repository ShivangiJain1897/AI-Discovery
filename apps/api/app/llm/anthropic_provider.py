"""Anthropic provider.

Structured output is obtained through a forced tool call: the contract's JSON
schema is handed over as a tool definition and the model is required to use it.
That produces schema-valid JSON directly, with no prose to strip and no fenced
block to parse.
"""

from __future__ import annotations

import json
import logging
from typing import TypeVar

import anthropic
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.llm.base import LLMProvider, LLMResult

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

#: Anthropic's tool schema rejects several JSON Schema keywords that Pydantic
#: emits. They carry no meaning for the model, so they are stripped.
_UNSUPPORTED_KEYS = {"$defs", "definitions", "discriminator", "examples", "default"}


def _inline_refs(schema: dict, defs: dict | None = None) -> dict:
    """Flatten `$ref` pointers into a self-contained schema."""
    defs = defs if defs is not None else schema.get("$defs", {})

    def walk(node):
        if isinstance(node, dict):
            if "$ref" in node:
                ref = node["$ref"].rsplit("/", 1)[-1]
                target = defs.get(ref, {})
                merged = walk({k: v for k, v in target.items() if k != "$ref"})
                for key, value in node.items():
                    if key != "$ref":
                        merged[key] = walk(value)
                return merged
            return {k: walk(v) for k, v in node.items() if k not in _UNSUPPORTED_KEYS}
        if isinstance(node, list):
            return [walk(item) for item in node]
        return node

    flattened = walk({k: v for k, v in schema.items() if k != "$defs"})
    flattened.setdefault("type", "object")
    return flattened


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self) -> None:
        headers = {}
        if settings.anthropic_workspace_id:
            # Organization-scoped keys require the workspace to be named.
            headers["anthropic-workspace-id"] = settings.anthropic_workspace_id
        self._client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key,
            timeout=settings.llm_timeout_seconds,
            default_headers=headers or None,
        )

    def complete_structured(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        max_tokens: int | None = None,
        fast: bool = False,
        context: dict | None = None,
    ) -> tuple[T, LLMResult]:
        del context  # already serialized into `user`
        model = settings.anthropic_fast_model if fast else settings.anthropic_model
        tool_schema = _inline_refs(schema.model_json_schema())
        tool_name = "emit_" + schema.__name__.lower()

        response = self._client.messages.create(
            model=model,
            max_tokens=max_tokens or settings.llm_max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            tools=[
                {
                    "name": tool_name,
                    "description": f"Return the {schema.__name__} for this stage.",
                    "input_schema": tool_schema,
                }
            ],
            tool_choice={"type": "tool", "name": tool_name},
        )

        payload = next(
            (block.input for block in response.content if block.type == "tool_use"),
            None,
        )
        if payload is None:
            raise RuntimeError(f"{model} returned no structured output for {schema.__name__}")

        result = LLMResult(
            data=payload,
            provider=self.name,
            model=model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            stop_reason=response.stop_reason or "",
        )

        try:
            return schema.model_validate(payload), result
        except ValidationError as exc:
            # One repair attempt: hand the model its own output and the errors.
            logger.warning("Structured output failed validation for %s: %s", schema.__name__, exc)
            result.warnings.append("validation_repair_attempted")
            repaired = self._client.messages.create(
                model=model,
                max_tokens=max_tokens or settings.llm_max_tokens,
                system=system,
                messages=[
                    {"role": "user", "content": user},
                    {"role": "assistant", "content": json.dumps(payload)[:8000]},
                    {
                        "role": "user",
                        "content": (
                            "That output failed schema validation with these errors:\n"
                            f"{exc}\n\nReturn a corrected object. Change only what the "
                            "errors require — do not add content the evidence does not "
                            "support."
                        ),
                    },
                ],
                tools=[
                    {
                        "name": tool_name,
                        "description": f"Return the corrected {schema.__name__}.",
                        "input_schema": tool_schema,
                    }
                ],
                tool_choice={"type": "tool", "name": tool_name},
            )
            fixed = next(
                (block.input for block in repaired.content if block.type == "tool_use"),
                None,
            )
            if fixed is None:
                raise
            result.data = fixed
            result.output_tokens += repaired.usage.output_tokens
            return schema.model_validate(fixed), result

    def complete_text(self, *, system: str, user: str, max_tokens: int | None = None) -> str:
        response = self._client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens or 2000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(block.text for block in response.content if block.type == "text")

    def health(self) -> dict:
        try:
            self._client.messages.create(
                model=settings.anthropic_fast_model,
                max_tokens=8,
                messages=[{"role": "user", "content": "ok"}],
            )
            return {"provider": self.name, "model": settings.anthropic_model, "status": "ok"}
        except Exception as exc:  # surfaced by /health, never raised to a request
            return {"provider": self.name, "status": "error", "detail": str(exc)[:300]}
