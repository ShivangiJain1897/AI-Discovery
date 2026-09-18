"""Application configuration.

Every external dependency (model, search, embeddings, storage) is selected
here by name so it can be replaced without touching call sites.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = Path(__file__).resolve().parents[1]
PROMPT_DIR = REPO_ROOT / "prompts"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", API_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core
    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    web_base_url: str = "http://localhost:3000"
    secret_key: str = "dev-secret-key"

    # Database
    database_url: str = "postgresql+psycopg://discovery:discovery@localhost:5432/discovery"
    embedding_dimension: int = 1024

    # LLM
    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5"
    anthropic_fast_model: str = "claude-haiku-4-5-20251001"
    anthropic_workspace_id: str = ""
    llm_max_tokens: int = 8000
    llm_timeout_seconds: int = 180

    # Search
    search_provider: str = "tavily"
    tavily_api_key: str = ""
    brave_api_key: str = ""
    search_results_per_query: int = 8
    search_timeout_seconds: int = 45

    # Embeddings
    embedding_provider: str = "mock"
    voyage_api_key: str = ""
    voyage_model: str = "voyage-3"

    # Storage
    storage_provider: str = "local"
    storage_local_path: str = "./storage"
    s3_bucket: str = ""
    s3_region: str = ""
    s3_endpoint_url: str = ""

    # Research behaviour
    max_sources_per_run: int = 40
    max_evidence_per_source: int = 12
    research_concurrency: int = 4

    # Safety / governance
    phi_detection_enabled: bool = True
    phi_on_detect: str = "warn"
    audit_log_enabled: bool = True
    data_retention_days: int = 365

    @property
    def prompt_dir(self) -> Path:
        return PROMPT_DIR

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_local_path)
        if not path.is_absolute():
            path = REPO_ROOT / path
        return path

    @property
    def effective_llm_provider(self) -> str:
        """Fall back to the deterministic provider when no credential is present.

        This is what lets the product run, and its tests pass, on a machine
        with no API keys — without any call site branching on configuration.
        """
        if self.llm_provider == "anthropic" and not self.anthropic_api_key:
            return "mock"
        return self.llm_provider

    @property
    def effective_search_provider(self) -> str:
        if self.search_provider == "tavily" and not self.tavily_api_key:
            return "mock"
        if self.search_provider == "brave" and not self.brave_api_key:
            return "mock"
        return self.search_provider

    @property
    def effective_embedding_provider(self) -> str:
        if self.embedding_provider == "voyage" and not self.voyage_api_key:
            return "mock"
        return self.embedding_provider

    @property
    def is_live_ai(self) -> bool:
        return self.effective_llm_provider != "mock"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
