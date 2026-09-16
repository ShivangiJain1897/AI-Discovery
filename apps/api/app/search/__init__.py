"""Web search abstraction."""

from __future__ import annotations

from functools import lru_cache

from app.config import settings
from app.search.base import SearchProvider, SearchResult

__all__ = ["SearchProvider", "SearchResult", "get_search_provider"]


@lru_cache
def get_search_provider() -> SearchProvider:
    name = settings.effective_search_provider
    if name == "tavily":
        from app.search.tavily_provider import TavilyProvider

        return TavilyProvider()
    if name == "brave":
        from app.search.brave_provider import BraveProvider

        return BraveProvider()
    if name == "mock":
        from app.search.mock_provider import MockSearchProvider

        return MockSearchProvider()
    raise ValueError(f"Unknown search provider: {name}")
