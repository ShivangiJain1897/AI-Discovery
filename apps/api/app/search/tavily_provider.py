"""Tavily search provider."""

from __future__ import annotations

import logging
from datetime import date, datetime
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.search.base import SearchProvider, SearchResult

logger = logging.getLogger(__name__)

_ENDPOINT = "https://api.tavily.com/search"


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


class TavilyProvider(SearchProvider):
    name = "tavily"

    def search(
        self,
        query: str,
        *,
        limit: int = 8,
        include_domains: list[str] | None = None,
        include_content: bool = True,
    ) -> list[SearchResult]:
        payload = {
            "api_key": settings.tavily_api_key,
            "query": query,
            "max_results": limit,
            "search_depth": "advanced",
            "include_raw_content": include_content,
        }
        if include_domains:
            payload["include_domains"] = include_domains

        try:
            response = httpx.post(
                _ENDPOINT, json=payload, timeout=settings.search_timeout_seconds
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            # A failed query degrades that query, never the whole research run.
            logger.warning("Tavily query failed (%s): %s", query, exc)
            return []

        results = []
        for item in response.json().get("results", []):
            url = item.get("url", "")
            results.append(
                SearchResult(
                    title=item.get("title", url),
                    url=url,
                    snippet=item.get("content", "")[:1200],
                    content=(item.get("raw_content") or item.get("content") or "")[:40000],
                    publisher=urlparse(url).netloc,
                    published=_parse_date(item.get("published_date")),
                    score=float(item.get("score", 0.0)),
                    raw=item,
                )
            )
        return results

    def health(self) -> dict:
        try:
            self.search("test", limit=1, include_content=False)
            return {"provider": self.name, "status": "ok"}
        except Exception as exc:
            return {"provider": self.name, "status": "error", "detail": str(exc)[:300]}
