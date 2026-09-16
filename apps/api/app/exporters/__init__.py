"""Document generation.

Exports are produced as native documents — a real DOCX with styled headings and
tables, a real XLSX with typed columns — not an HTML screenshot or a PDF of a
web page. Headings, tables, citations, links and source metadata all survive,
because an exported PRD that has lost its citations is no longer traceable and
the traceability is the product.
"""

from __future__ import annotations

from app.exporters.registry import EXPORTERS, export_artifact, export_table

__all__ = ["EXPORTERS", "export_artifact", "export_table"]
