"""Embedding provider abstraction, used for semantic evidence retrieval."""

from __future__ import annotations

import hashlib
import math
from functools import lru_cache

import httpx

from app.config import settings


class EmbeddingProvider:
    name = "base"

    def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError


class VoyageProvider(EmbeddingProvider):
    name = "voyage"

    def embed(self, texts: list[str]) -> list[list[float]]:
        response = httpx.post(
            "https://api.voyageai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.voyage_api_key}"},
            json={"input": texts, "model": settings.voyage_model},
            timeout=60,
        )
        response.raise_for_status()
        return [item["embedding"] for item in response.json()["data"]]


class HashingProvider(EmbeddingProvider):
    """Deterministic hashed bag-of-words vectors.

    Not semantic — it will not relate "cost" to "price". It exists so the
    vector column, the similarity query and the retrieval path are exercised
    without a credential, and so swapping in a real provider is a config change
    rather than a code change.
    """

    name = "hashing"

    def embed(self, texts: list[str]) -> list[list[float]]:
        dimension = settings.embedding_dimension
        vectors = []
        for text in texts:
            vector = [0.0] * dimension
            for token in text.lower().split():
                digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
                index = int.from_bytes(digest[:4], "big") % dimension
                sign = 1.0 if digest[4] % 2 == 0 else -1.0
                vector[index] += sign
            norm = math.sqrt(sum(v * v for v in vector)) or 1.0
            vectors.append([v / norm for v in vector])
        return vectors


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    if settings.effective_embedding_provider == "voyage":
        return VoyageProvider()
    return HashingProvider()
