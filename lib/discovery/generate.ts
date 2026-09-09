/**
 * Turning the research into a document.
 *
 * Reads only what the discovery already found. Asking for a PRD after a backlog
 * reuses the same research — nothing is re-run.
 */
import { getProvider } from "../llm/provider";
import { documentSpec, getDocument, type DocumentDef } from "./documents";
import { getLens } from "./lenses";
import type { Discovery, DocSection, Finding, GeneratedDoc } from "./types";

export interface RefineOptions {
  /** What the PM asked to be changed. */
  instruction?: string;
  /** The version being revised, so the rewrite builds on it. */
  previous?: GeneratedDoc;
}

export async function generateDocument(
  d: Discovery,
  documentId: string,
  opts: RefineOptions = {}
): Promise<GeneratedDoc> {
  const def = getDocument(documentId);
  if (!def) throw new Error(`Unknown document: ${documentId}`);
  const provider = await getProvider();

  let sections: DocSection[];
  if (provider.mode === "live") {
    try {
      sections = await live(d, documentId, opts);
    } catch {
      sections = skeleton(d, def, opts);
    }
  } else {
    sections = skeleton(d, def, opts);
  }

  const version = d.documents.filter((x) => x.documentId === def.id).length + 1;

  return {
    id: `doc_${Math.random().toString(36).slice(2, 8)}`,
    documentId: def.id,
    title: def.name,
    sections,
    instruction: opts.instruction,
    version,
    createdAt: Date.now(),
  };
}

/** Everything the research turned up, as one readable block. */
export function researchBlock(d: Discovery): string {
  const out: string[] = [
    `THE ${d.kind.toUpperCase()}:`,
    `"""\n${d.idea.slice(0, 4000)}\n"""`,
    ``,
    `CONTEXT`,
    `- Industry: ${d.context.industry}`,
    `- Users: ${d.context.users}`,
    `- Problem: ${d.context.problem}`,
    `- Goal: ${d.context.goal}`,
  ];

  if (d.notes.length) {
    out.push(``, `EXTRA CONTEXT FROM THE PRODUCT MANAGER (treat as given):`, ...d.notes.map((n) => `- ${n}`));
  }

  const done = d.lenses.filter((l) => l.status === "done" && l.findings.length > 0);
  if (done.length) {
    out.push(``, `WHAT THE RESEARCH FOUND`);
    for (const l of done) {
      out.push(``, `## ${getLens(l.lensId)?.name ?? l.lensId}`);
      if (l.summary) out.push(l.summary);
      for (const f of l.findings) out.push(`- [${f.confidence} confidence] ${f.title}: ${f.detail} (based on: ${f.basis})`);
      if (l.gaps.length) out.push(`Not established: ${l.gaps.join(" | ")}`);
      if (l.sources.length) out.push(`Sources: ${l.sources.join(", ")}`);
    }
  } else {
    out.push(``, `WHAT THE RESEARCH FOUND: nothing yet — do not write as though evidence exists.`);
  }

  if (d.summary?.headline) {
    const s = d.summary;
    out.push(
      ``,
      `PULLED TOGETHER`,
      `Headline: ${s.headline}`,
      s.learned.length ? `What we know: ${s.learned.join(" | ")}` : "",
      s.opportunities.length ? `Opportunities: ${s.opportunities.join(" | ")}` : "",
      s.risks.length ? `Risks: ${s.risks.join(" | ")}` : ""
    );
  }

  return out.filter((x) => x !== undefined).join("\n");
}

async function live(d: Discovery, documentId: string, opts: RefineOptions = {}): Promise<DocSection[]> {
  const def = getDocument(documentId)!;
  const provider = await getProvider();

  // A refinement is a rewrite of a specific version, not a fresh attempt — so
  // the parts the PM didn't complain about survive.
  const revising =
    opts.instruction && opts.previous
      ? `\n\n---\n\nYOU ARE REVISING AN EXISTING VERSION. Here it is:\n\n${asMarkdown(opts.previous.sections)}\n\nTHE PM ASKED FOR THIS CHANGE:\n"""\n${opts.instruction.slice(0, 1500)}\n"""\n\nApply exactly that change. Keep everything else as it was — do not rewrite sections they did not ask about, and do not drop content to make room. Return the COMPLETE document, not just the changed parts.`
      : opts.instruction
        ? `\n\nTHE PM ASKED FOR THIS SPECIFICALLY:\n"""\n${opts.instruction.slice(0, 1500)}\n"""`
        : "";

  const raw = await provider.generateJson<{ sections?: DocSection[] }>({
    system: `You are a senior product manager writing a document from research that has already been done.

Rules:
- Use the research you're given. Don't add facts that aren't in it, and don't soften a finding to make the document read better.
- Where the research doesn't support a section, say so in that section rather than filling it with generic content. A short honest document beats a long padded one.
- Never invent numbers, quotes, competitor details, prices or metrics.
- Write for someone who has to act on this. Specific and plain, no consultancy filler.
- Use a table where a table genuinely reads better than prose. Every row must come from the research.`,
    prompt: `${researchBlock(d)}

---

${documentSpec(def, d.kind)}${revising}

Return JSON: { "sections": [ { "heading": string, "body"?: string, "bullets"?: string[], "table"?: { "headers": string[], "rows": string[][] } } ] }`,
    maxTokens: 8000,
  });

  const sections = normalize(raw?.sections);
  return sections.length ? sections : skeleton(d, getDocument(documentId)!, opts);
}

/** Render sections back to Markdown, so a revision can see what it's revising. */
function asMarkdown(sections: DocSection[]): string {
  const out: string[] = [];
  for (const s of sections) {
    out.push(`## ${s.heading}`);
    if (s.body) out.push(s.body);
    if (s.bullets?.length) out.push(...s.bullets.map((b) => `- ${b}`));
    if (s.table) {
      out.push(`| ${s.table.headers.join(" | ")} |`);
      out.push(`| ${s.table.headers.map(() => "---").join(" | ")} |`);
      for (const r of s.table.rows) out.push(`| ${r.join(" | ")} |`);
    }
    out.push("");
  }
  return out.join("\n").slice(0, 12000);
}

function normalize(raw: unknown): DocSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is DocSection => Boolean(s) && typeof s === "object")
    .map((s) => {
      const out: DocSection = { heading: String(s.heading || "Section") };
      if (s.body) out.body = String(s.body);
      if (Array.isArray(s.bullets)) {
        const b = s.bullets.map((x) => String(x).trim()).filter(Boolean);
        if (b.length) out.bullets = b;
      }
      if (s.table && Array.isArray(s.table.headers) && Array.isArray(s.table.rows)) {
        const headers = s.table.headers.map(String);
        const rows = s.table.rows
          .filter(Array.isArray)
          // Pad ragged rows — a mismatched table renders as a broken document.
          .map((r) => headers.map((_, i) => String(r[i] ?? "")));
        if (headers.length && rows.length) out.table = { headers, rows };
      }
      return out;
    })
    .filter((s) => s.body || s.bullets?.length || s.table?.rows.length);
}

/**
 * No API key, or the call failed.
 *
 * Rather than a dead end, build the document's real skeleton and slot the
 * research that DOES exist into the sections it belongs in. Every section says
 * plainly whether it holds real findings or is waiting to be written, so this
 * can never be mistaken for a finished document — but you can see the shape of
 * what you'd get, and the evidence is genuinely yours.
 */
function skeleton(d: Discovery, def: DocumentDef, opts: RefineOptions = {}): DocSection[] {
  // Nothing can be rewritten without a model, so hand back what was there.
  if (opts.previous) {
    return [
      {
        heading: "Not revised",
        body:
          d.mode === "demo"
            ? `Demo mode: there's no model to revise this with, so the document below is unchanged. You asked for: "${opts.instruction ?? ""}". Add an ANTHROPIC_API_KEY and ask again.`
            : `The revision call failed, so the document below is unchanged. You asked for: "${opts.instruction ?? ""}". Try again.`,
      },
      ...opts.previous.sections,
    ];
  }
  const findings = d.lenses.filter((l) => l.status === "done").flatMap((l) => l.findings);
  const gaps = d.lenses.flatMap((l) => l.gaps);
  const byLens = (id: string) => d.lenses.find((l) => l.lensId === id)?.findings ?? [];

  const sections: DocSection[] = [
    {
      heading: `Outline only — not yet written`,
      body:
        d.mode === "demo"
          ? `Demo mode: there's no API key, so this hasn't been written. Below is the real structure of a ${def.prose}, with the research from this discovery slotted into the sections it belongs in. Add an ANTHROPIC_API_KEY and ask for it again to get the written document.`
          : `The ${def.prose} couldn't be written — the AI call didn't return a usable result. Your research is intact and slotted into the outline below. Ask again to retry.`,
    },
  ];

  for (const heading of def.outline(d.kind)) {
    const h = heading.toLowerCase();
    let section: DocSection = { heading };

    if (/user/.test(h) && !/non-functional/.test(h)) {
      section = fill(heading, byLens("user_research"), `Who this is for. ${d.context.users}`);
    } else if (/problem|why now|the ask/.test(h)) {
      section = { heading, body: d.context.problem, bullets: top(findings, 3) };
    } else if (/market|alternative/.test(h)) {
      section = fill(heading, byLens("market"), "Who else solves this, and how.");
    } else if (/edge case|error/.test(h)) {
      section = fill(heading, byLens("bugs"), "What happens when it goes wrong.");
    } else if (/how it works|capabilit|requirement|what we'd do|scope/.test(h)) {
      section = fill(heading, byLens("process"), "To be written from the research.");
    } else if (/constraint|compliance/.test(h)) {
      section = fill(heading, byLens("compliance"), "No compliance research was run for this discovery.");
    } else if (/risk|dependenc/.test(h)) {
      section = { heading, bullets: gaps.length ? gaps.slice(0, 6) : ["To be written from the research."] };
    } else if (/assumption/.test(h)) {
      section = findings.length
        ? {
            heading,
            body: "Every finding this rests on, with how confident we are in it.",
            table: {
              headers: ["What we're assuming", "Based on", "Confidence"],
              rows: findings.map((f) => [f.title, f.basis, f.confidence]),
            },
          }
        : { heading, bullets: ["To be written from the research."] };
    } else if (/open question|still/.test(h)) {
      section = { heading, bullets: gaps.length ? gaps : ["To be written from the research."] };
    } else {
      section = { heading, bullets: ["To be written from the research."] };
    }
    sections.push(section);
  }

  return sections;
}

/** A section backed by one lens's findings, or an honest note that it isn't. */
function fill(heading: string, findings: Finding[], fallback: string): DocSection {
  if (findings.length === 0) return { heading, bullets: [fallback] };
  return {
    heading,
    bullets: findings.map((f) => `${f.title} — ${f.detail}`),
  };
}

function top(findings: Finding[], n: number): string[] {
  const rank = { High: 0, Medium: 1, Low: 2 };
  return [...findings]
    .sort((a, b) => rank[a.confidence] - rank[b.confidence])
    .slice(0, n)
    .map((f) => `${f.title} (${f.confidence.toLowerCase()} confidence)`);
}
