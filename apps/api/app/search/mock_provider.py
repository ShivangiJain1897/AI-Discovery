"""Deterministic search provider.

Returns results drawn from the source registry rather than invented URLs, so a
run without credentials still exercises real routing, real tiering and the real
extraction path. Every result is explicitly labelled as a placeholder in its
content, so it can never be mistaken for retrieved evidence.
"""

from __future__ import annotations

import hashlib

from app.domain.enums import ResearchType
from app.search.base import SearchProvider, SearchResult
from app.services import source_registry

PLACEHOLDER = (
    "[PLACEHOLDER — no search provider configured] "
    "This result stands in for a real document from {name}. {why} "
    "Configure SEARCH_PROVIDER and an API key to retrieve actual content. "
    "Nothing extracted from this text is evidence about the research question."
)


class MockSearchProvider(SearchProvider):
    name = "mock"

    def search(
        self,
        query: str,
        *,
        limit: int = 8,
        include_domains: list[str] | None = None,
        include_content: bool = True,
    ) -> list[SearchResult]:
        lowered = query.lower()
        domain = next(
            (
                d
                for d in ("healthcare", "life sciences", "technology", "financial services")
                if d.split()[0] in lowered
            ),
            None,
        )
        types = [t for t in ResearchType if t.value.replace("_", " ") in lowered]

        candidates = source_registry.lookup(
            domain=domain,
            research_types=types or None,
            geography="United States" if "medicaid" in lowered or "medicare" in lowered else None,
            limit=limit,
        )
        if not candidates:
            candidates = list(source_registry.GENERAL[:limit])

        results = []
        for index, source in enumerate(candidates[:limit]):
            digest = hashlib.sha256(f"{query}:{source.name}".encode()).hexdigest()[:8]
            body = PLACEHOLDER.format(name=source.name, why=source.why)
            results.append(
                SearchResult(
                    title=f"{source.name} — placeholder result for: {query[:80]}",
                    url=source.url or f"https://example.invalid/{digest}",
                    snippet=body[:600],
                    content=body if include_content else "",
                    publisher=source.name,
                    published=None,
                    score=1.0 - (index * 0.05),
                    raw={
                        "placeholder": True,
                        "registry_source": source.name,
                        "tier": source.tier.value,
                        "source_type": source.source_type.value,
                    },
                )
            )
        return results

    def health(self) -> dict:
        return {
            "provider": self.name,
            "status": "ok",
            "detail": "Deterministic placeholder results; no live retrieval.",
        }
