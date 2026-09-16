"""Model provider abstraction.

Call sites ask for a provider and get one. Which implementation they get is a
configuration decision, made once in `get_llm_provider`.
"""

from __future__ import annotations

from functools import lru_cache

from app.config import settings
from app.llm.base import LLMProvider, LLMResult

__all__ = ["LLMProvider", "LLMResult", "get_llm_provider"]


@lru_cache
def get_llm_provider() -> LLMProvider:
    name = settings.effective_llm_provider
    if name == "anthropic":
        from app.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider()
    if name == "mock":
        from app.llm.mock_provider import MockProvider

        return MockProvider()
    raise ValueError(f"Unknown LLM provider: {name}")
