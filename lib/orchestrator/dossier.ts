/**
 * The session dossier — the single source of accumulated evidence.
 *
 * Analysis, decision and every generated artifact read from here and ONLY from
 * here. That is what makes the spec's rule true in code: research is never
 * repeated because a second format was requested. Ask for a PRD after a
 * decision memo and the same dossier is reused.
 */
import { capabilityName } from "./catalog/research";
import type { Session } from "./types";

export interface DossierOptions {
  /** Include the full per-stream evidence lists (default true). */
  includeEvidence?: boolean;
  /** Include the applied analyses (default true). */
  includeAnalyses?: boolean;
  /** Include the decision brief (default true). */
  includeDecision?: boolean;
}

export function evidenceDossier(session: Session, opts: DossierOptions = {}): string {
  const { includeEvidence = true, includeAnalyses = true, includeDecision = true } = opts;
  const p = session.plan;
  const out: string[] = [];

  out.push(`# THE QUESTION
OBJECTIVE: ${p.objective}
DECISION IN SERVICE OF: ${p.decision}
SCOPE: ${p.scope}
STAKEHOLDERS: ${p.stakeholders}
EVIDENCE THE PM ALREADY HAD: ${p.existingEvidence}
OUTPUT CONSUMER: ${p.consumer}

ORIGINAL REQUEST (${session.inputType}):
"""
${session.input.slice(0, 4000)}
"""`);

  if (p.assumptions.length) {
    out.push(`# ASSUMPTIONS IN FORCE (never present these as facts)\n${p.assumptions.map((a) => `- ${a}`).join("\n")}`);
  }
  const answered = p.clarifications.filter((c) => c.answer.trim());
  if (answered.length) {
    out.push(`# THE PM CLARIFIED\n${answered.map((c) => `- ${c.question} → ${c.answer}`).join("\n")}`);
  }
  const unanswered = p.clarifications.filter((c) => !c.answer.trim());
  if (unanswered.length) {
    out.push(`# STILL UNANSWERED (treat as open gaps)\n${unanswered.map((c) => `- ${c.question}`).join("\n")}`);
  }
  if (session.notes.length) {
    out.push(`# CONTEXT THE PM ADDED DURING THE SESSION\n${session.notes.map((n) => `- ${n}`).join("\n")}`);
  }

  const streams = session.streams.filter((s) => s.selected && s.status === "complete");
  if (streams.length) {
    const blocks = streams.map((s) => {
      const lines = [`## ${capabilityName(s.capabilityId)}`];
      if (s.summary) lines.push(s.summary);
      if (includeEvidence && s.evidence.length) {
        lines.push("Evidence:");
        for (const e of s.evidence) {
          lines.push(`- [${e.type.toUpperCase()} / ${e.strength}] ${e.statement}${e.source ? ` (source: ${e.source})` : ""}`);
        }
      }
      if (s.findings.length) {
        lines.push("Findings:");
        for (const f of s.findings) lines.push(`- [${f.strength}] ${f.title}: ${f.detail}`);
      }
      if (s.contradictions.length) lines.push(`Contradictions: ${s.contradictions.join(" | ")}`);
      if (s.gaps.length) lines.push(`Gaps: ${s.gaps.join(" | ")}`);
      if (s.implications.length) lines.push(`Implications: ${s.implications.join(" | ")}`);
      if (s.sources.length) lines.push(`Sources: ${s.sources.join(", ")}`);
      if (s.userNotes) lines.push(`PM note: ${s.userNotes}`);
      return lines.join("\n");
    });
    out.push(`# RESEARCH EVIDENCE (Layer 1)\n\n${blocks.join("\n\n")}`);
  } else {
    out.push(`# RESEARCH EVIDENCE (Layer 1)\nNo research streams have completed. Do not assert anything as evidence-backed.`);
  }

  const syn = session.synthesis;
  if (syn) {
    const lines = [`HEADLINE: ${syn.headline}`];
    if (syn.themes.length) {
      lines.push("Themes:");
      for (const t of syn.themes) lines.push(`- [${t.strength}] ${t.title}: ${t.body} (from: ${t.supportedBy.join(", ")})`);
    }
    if (syn.triangulation.length) {
      lines.push("Triangulation:");
      for (const t of syn.triangulation) lines.push(`- [${t.agreement} / ${t.strength}] ${t.insight} (across: ${t.sources.join(", ")})`);
    }
    if (syn.insights.length) {
      lines.push("Insights and their so-what:");
      for (const i of syn.insights) lines.push(`- [${i.confidence} | ${i.implication}] ${i.insight} → ${i.soWhat}`);
    }
    if (syn.opportunities.length) {
      lines.push("Opportunities:");
      for (const o of syn.opportunities) lines.push(`- [${o.evidence}] ${o.title} — ${o.hmw} (user: ${o.userValue}; business: ${o.businessValue})`);
    }
    if (syn.contradictions.length) lines.push(`Contradictions: ${syn.contradictions.join(" | ")}`);
    if (syn.gaps.length) lines.push(`Open gaps: ${syn.gaps.join(" | ")}`);
    out.push(`# CROSS-STREAM SYNTHESIS (Steps 5-6)\n${lines.join("\n")}`);
  }

  if (includeAnalyses && session.analyses.length) {
    const blocks = session.analyses.map((a) => {
      const body = a.sections
        .map((s) => {
          const parts = [`### ${s.heading}${s.method ? ` (${s.method})` : ""}`];
          if (s.body) parts.push(s.body);
          if (s.bullets?.length) parts.push(s.bullets.map((b) => `- ${b}`).join("\n"));
          if (s.table) {
            parts.push(`| ${s.table.headers.join(" | ")} |`);
            for (const r of s.table.rows) parts.push(`| ${r.join(" | ")} |`);
          }
          return parts.join("\n");
        })
        .join("\n");
      return `## ${a.name} (${a.method})\n${body}`;
    });
    out.push(`# ANALYSES APPLIED (Layer 2)\n\n${blocks.join("\n\n")}`);
  }

  const d = session.decision;
  if (includeDecision && d) {
    out.push(`# DECISION (Layer 3)
What we know: ${d.evidence.join(" | ")}
What it means: ${d.insight}
Options considered:
${d.options.map((o) => `- ${o.name}: ${o.description} | benefits: ${o.benefits} | costs: ${o.costs} | risks: ${o.risks} | effort: ${o.effort}`).join("\n")}
RECOMMENDATION: ${d.recommendation}
Rationale: ${d.rationale}
Confidence: ${d.confidence}
Evidence gaps: ${d.gaps.join(" | ")}
Next steps: ${d.nextSteps.join(" | ")}`);
  }

  return out.join("\n\n");
}
