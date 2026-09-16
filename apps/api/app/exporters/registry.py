"""Format registry and the export entry points."""

from __future__ import annotations

from collections.abc import Callable

from app.domain.enums import ExportFormat
from app.exporters import formats
from app.exporters.model import Document

EXPORTERS: dict[str, tuple[Callable[[Document], bytes], str, str]] = {
    ExportFormat.MARKDOWN.value: (formats.to_markdown, "md", "text/markdown"),
    ExportFormat.JSON.value: (formats.to_json, "json", "application/json"),
    ExportFormat.CSV.value: (formats.to_csv, "csv", "text/csv"),
    ExportFormat.XLSX.value: (
        formats.to_xlsx, "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    ExportFormat.DOCX.value: (
        formats.to_docx, "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    ExportFormat.PDF.value: (formats.to_pdf, "pdf", "application/pdf"),
}


def export_artifact(doc: Document, fmt: str) -> tuple[bytes, str, str]:
    """Render a document. Returns (bytes, filename, media type)."""
    try:
        renderer, extension, media_type = EXPORTERS[fmt]
    except KeyError:
        raise ValueError(
            f"Unsupported export format '{fmt}'. Supported: {', '.join(sorted(EXPORTERS))}"
        ) from None
    return renderer(doc), f"{doc.filename_stem}.{extension}", media_type


#: Tables have no meaningful DOCX/PDF-only path; they export everywhere.
export_table = export_artifact
