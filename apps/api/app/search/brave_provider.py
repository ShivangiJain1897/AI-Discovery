"""Brave Search provider.

Brave returns descriptions rather than page bodies, so extraction works from
snippets unless a fetcher is added upstream.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.search.base import SearchProvider, SearchResult

logger = logging.getLogger(__name__)

_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"


class BraveProvider(SearchProvider):
    name = "brave"

    def search(
        self,
        query: str,
        *,
        limit: int = 8,
        include_domains: list[str] | None = None,
        include_content: bool = True,
    ) -> list[SearchResult]:
        if include_domains:
            # Brave has no domain filter parameter; express it in the query.
            query = f"{query} " + " OR ".join(f"site:{d}" for d in include_domains)

        try:
            response = httpx.get(
                _ENDPOINT,
                params={"q": query, "count": limit},
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": settings.brave_api_key,
                },
                timeout=settings.search_timeout_seconds,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("Brave query failed (%s): %s", query, exc)
            return []

        results = []
        for item in response.json().get("web", {}).get("results", []):
            url = item.get("url", "")
            published: date | None = None
            if item.get("age"):
                try:
                    published = datetime.strptime(item["age"], "%Y-%m-%d").date()
                except ValueError:
                    published = None
            description = item.get("description", "")
            results.append(
                SearchResult(
                    title=item.get("title", url),
                    url=url,
                    snippet=description[:1200],
                    content=description[:40000],
                    publisher=item.get("profile", {}).get("name") or urlparse(url).netloc,
                    published=published,
                    raw=item,
                )
            )
        return results
