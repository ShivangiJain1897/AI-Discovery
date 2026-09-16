"""The shape every exporter renders.

Artifacts, analyses and research reports are normalized into this one document
model, so a new export format is written once rather than once per artifact
type.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass
class DocSection:
    heading: str
    body: str = ""
    points: list[str] = field(default_factory=list)
    columns: list[str] = field(default_factory=list)
    rows: list[dict[str, str]] = field(default_factory=list)
    evidence_refs: list[str] = field(default_factory=list)
    knowledge_state: str = "known"
    note: str | None = None

    @property
    def has_content(self) -> bool:
        return bool(self.body or self.points or self.rows)


@dataclass
class DocCitation:
    ref: str
    statement: str
    excerpt: str
    source_title: str
    source_url: str | None
    publisher: str | None
    publication_date: str | None
    tier: str
    strength: str
    evidence_type: str


@dataclass
class Document:
    title: str
    subtitle: str = ""
    summary: str = ""
    sections: list[DocSection] = field(default_factory=list)
    citations: list[DocCitation] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)
    generated_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def filename_stem(self) -> str:
        safe = "".join(c if c.isalnum() or c in "-_ " else "" for c in self.title).strip()
        return (safe.replace(" ", "-").lower() or "document")[:80]
