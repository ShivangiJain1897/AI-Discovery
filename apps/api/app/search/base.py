"""The search provider contract."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from datetime import date


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str = ""
    content: str = ""
    publisher: str = ""
    published: date | None = None
    score: float = 0.0
    raw: dict = field(default_factory=dict)


class SearchProvider(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    def search(
        self,
        query: str,
        *,
        limit: int = 8,
        include_domains: list[str] | None = None,
        include_content: bool = True,
    ) -> list[SearchResult]:
        """Run one query and return ranked results."""

    def health(self) -> dict:
        return {"provider": self.name, "status": "ok"}
