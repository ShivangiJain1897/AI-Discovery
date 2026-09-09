/** Shared normalization for any model-produced document section. */
import type { DocSection } from "./types";

export function normalizeSections(raw: unknown): DocSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is DocSection => Boolean(s) && typeof s === "object")
    .map(normalizeSection)
    .filter((s) => s.body || (s.bullets && s.bullets.length) || (s.table && s.table.rows.length));
}

export function normalizeSection(s: DocSection): DocSection {
  const out: DocSection = { heading: String(s.heading || "Section") };
  if (s.method) out.method = String(s.method);
  if (s.body) out.body = String(s.body);
  if (Array.isArray(s.bullets)) {
    const b = s.bullets.map((x) => String(x).trim()).filter(Boolean);
    if (b.length) out.bullets = b;
  }
  if (s.table && Array.isArray(s.table.headers) && Array.isArray(s.table.rows)) {
    const headers = s.table.headers.map(String);
    const rows = s.table.rows
      .filter(Array.isArray)
      .map((r) => r.map((c) => String(c ?? "")))
      // Pad or trim so every row matches the header count — a ragged table
      // renders as a broken document.
      .map((r) => (r.length === headers.length ? r : headers.map((_, i) => r[i] ?? "")));
    if (headers.length && rows.length) out.table = { headers, rows };
  }
  return out;
}
