"""Loads the version-controlled prompt library from /prompts.

A stage asks for a prompt by key and gets back a rendered (system, user)
pair plus the contract class it must return. The universal preamble is
prepended here rather than repeated in thirty-one files, and the output schema
named in YAML is resolved against `app.domain.contracts` — so a prompt that
names a schema which no longer exists fails at load, not at request time.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel

from app.config import settings
from app.domain import contracts

logger = logging.getLogger(__name__)

UNIVERSAL_KEY = "_universal"


@dataclass
class PromptTemplateFile:
    key: str
    name: str
    stage: str
    version: str
    purpose: str
    instructions: str
    guardrails: list[str]
    inputs: list[dict] = field(default_factory=list)
    output_schema: str | None = None
    examples: list[dict] = field(default_factory=list)
    path: Path | None = None
    checksum: str = ""

    @property
    def schema_class(self) -> type[BaseModel] | None:
        if not self.output_schema:
            return None
        klass = getattr(contracts, self.output_schema, None)
        if klass is None:
            raise ValueError(
                f"Prompt '{self.key}' names output_schema '{self.output_schema}', "
                "which is not defined in app.domain.contracts"
            )
        return klass


class PromptLibrary:
    def __init__(self, directory: Path | None = None) -> None:
        self.directory = directory or settings.prompt_dir
        self._templates: dict[str, PromptTemplateFile] = {}
        self._load()

    def _load(self) -> None:
        if not self.directory.exists():
            raise FileNotFoundError(f"Prompt directory not found: {self.directory}")

        for path in sorted(self.directory.glob("*.yaml")):
            raw = path.read_text(encoding="utf-8")
            data = yaml.safe_load(raw) or {}
            template = PromptTemplateFile(
                key=data["key"],
                name=data["name"],
                stage=data.get("stage", ""),
                version=str(data.get("version", "1.0.0")),
                purpose=data.get("purpose", "").strip(),
                instructions=data.get("instructions", "").strip(),
                guardrails=data.get("guardrails") or [],
                inputs=data.get("inputs") or [],
                output_schema=data.get("output_schema"),
                examples=data.get("examples") or [],
                path=path,
                checksum=hashlib.sha256(raw.encode()).hexdigest(),
            )
            if template.key in self._templates:
                raise ValueError(f"Duplicate prompt key '{template.key}' in {path.name}")
            self._templates[template.key] = template

        if UNIVERSAL_KEY not in self._templates:
            raise ValueError(f"Prompt library is missing {UNIVERSAL_KEY}.yaml")

        # Fail at import rather than mid-pipeline on a stale schema name.
        for template in self._templates.values():
            template.schema_class  # noqa: B018

        logger.info("Loaded %d prompt templates from %s", len(self._templates), self.directory)

    # ── access ───────────────────────────────────────────────

    def get(self, key: str) -> PromptTemplateFile:
        try:
            return self._templates[key]
        except KeyError:
            raise KeyError(f"Unknown prompt key: {key}") from None

    def all(self) -> list[PromptTemplateFile]:
        return [t for k, t in sorted(self._templates.items()) if k != UNIVERSAL_KEY]

    def by_stage(self) -> dict[str, list[PromptTemplateFile]]:
        grouped: dict[str, list[PromptTemplateFile]] = {}
        for template in self.all():
            grouped.setdefault(template.stage, []).append(template)
        return grouped

    # ── rendering ────────────────────────────────────────────

    def render(self, key: str, inputs: dict[str, Any]) -> tuple[str, str, type[BaseModel] | None]:
        """Return (system, user, schema) for a stage.

        Inputs are serialized as JSON under labelled headings rather than
        interpolated into prose, so a long evidence library stays parseable and
        a value containing braces cannot corrupt the prompt.
        """
        template = self.get(key)
        universal = self._templates[UNIVERSAL_KEY]

        system_parts = [
            universal.instructions,
            "",
            "─" * 60,
            f"STAGE: {template.name}  (prompt {template.key} v{template.version})",
            "─" * 60,
            "",
            f"PURPOSE\n{template.purpose}",
            "",
            template.instructions,
        ]
        if template.guardrails:
            system_parts += [
                "",
                "GUARDRAILS FOR THIS STAGE",
                *(f"- {g}" for g in template.guardrails),
            ]
        if template.examples:
            system_parts += ["", "EXAMPLES", json.dumps(template.examples, indent=2)]

        declared = {i.get("name") for i in template.inputs}
        user_parts: list[str] = []
        for name, value in inputs.items():
            if value is None or value == [] or value == {}:
                continue
            label = name.upper().replace("_", " ")
            if isinstance(value, str):
                body = value
            else:
                body = json.dumps(value, indent=2, default=str)
            user_parts.append(f"## {label}\n{body}")

        missing = declared - set(inputs)
        if missing:
            user_parts.append(
                "## NOT SUPPLIED\n"
                + "\n".join(f"- {m}: not available for this project" for m in sorted(missing))
            )

        user = "\n\n".join(user_parts) or "No inputs supplied."
        return "\n".join(system_parts), user, template.schema_class


@lru_cache
def get_prompt_library() -> PromptLibrary:
    return PromptLibrary()
