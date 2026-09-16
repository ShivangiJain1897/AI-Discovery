"""The provider contract."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


@dataclass
class LLMResult:
    """A structured completion plus what it cost and where it came from."""

    data: dict
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    stop_reason: str = ""
    warnings: list[str] = field(default_factory=list)


class LLMProvider(abc.ABC):
    """Returns structured objects, never free-form prose.

    Every stage of the pipeline exchanges typed contracts, so the provider's
    job is to produce JSON that validates against a given schema — not text
    that a caller then has to parse.
    """

    name: str = "base"

    @abc.abstractmethod
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
        """Return an instance of `schema` and the call metadata.

        `context` carries the same stage inputs already serialized into
        `user`. Model-backed providers ignore it; the deterministic provider
        uses it to build output from the real project data.
        """

    @abc.abstractmethod
    def complete_text(self, *, system: str, user: str, max_tokens: int | None = None) -> str:
        """Free-form completion. Used only for the copilot's prose answers."""

    def health(self) -> dict:
        return {"provider": self.name, "status": "ok"}
