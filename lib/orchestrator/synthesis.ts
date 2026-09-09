/**
 * STEPS 5–6 — cross-stream synthesis.
 *
 * This is the most important step in the system and the one most easily faked.
 * Concatenating specialist reports is NOT synthesis. What matters is the
 * relationships BETWEEN streams:
 *
 *   - a customer complaint corroborated by usage behaviour
 *   - a market opportunity contradicted by willingness to pay
 *   - a feature request caused by a deeper workflow problem
 *   - defect data explaining low adoption
 *   - a competitor advantage revealing an unmet customer need
 *
 * Then every insight is forced through "so what?" until it becomes a product
 * implication: fix / build / remove / simplify / reposition / experiment /
 * validate / change pricing / change onboarding / change workflow / defer /
 * retire / improve operations. An insight that stops at "interesting" is
 * treated as unfinished work.
 */
import { getProvider } from "../llm/provider";
import { capabilityName } from "./catalog/research";
import { getDepth } from "./catalog/depth";
import { EVIDENCE_DISCIPLINE } from "./universal";
import type {
  Confidence,
  EvidenceStrength,
  ImplicationKind,
  Insight,
  Opportunity,
  ResearchStream,
  Session,
  Synthesis,
  Triangulation,
} from "./types";

const IMPLICATIONS: ImplicationKind[] = [
  "fix", "build", "remove", "simplify", "reposition", "experiment", "validate",
  "pricing", "onboarding", "workflow", "defer", "retire", "operational",
];
const STRENGTHS: EvidenceStrength[] = ["Strong", "Moderate", "Directional", "Hypothesis"];
const CONFIDENCES: Confidence[] = ["High", "Medium", "Low"];

const SYNTHESIS_SYSTEM = `${EVIDENCE_DISCIPLINE}

---

You are the ORCHESTRATOR performing cross-stream synthesis.

Several specialists have each reported on the same question through a different lens. Your job is NOT to summarise them one by one — that work is already done and repeating it is worthless. Your job is to find what is only visible when you look across them:

- Where one lens CORROBORATES another (a complaint backed by behaviour is far stronger evidence than either alone — say so, and grade it up).
- Where one lens CONTRADICTS another (users say they want it; willingness to pay says they will not fund it). Contradictions are findings, not noise. Never resolve one by silently preferring the more convenient lens; state both and say what would settle it.
- Where one lens EXPLAINS another (a defect cluster explaining low adoption; a workflow bottleneck explaining a feature request).
- Where a stated request is a SYMPTOM of something the other lenses reveal.

Then convert the picture into decisions:

  EVIDENCE → PATTERNS → INSIGHTS → OPPORTUNITIES

Every insight must answer SO WHAT. An insight that stops at "interesting" is unfinished. The "so what" must name a product action: fix, build, remove, simplify, reposition, run an experiment, gather more evidence, change pricing, change onboarding, change workflow, defer investment, retire something, or improve an operational process.

Grade honestly. If every stream reported gaps, the correct synthesis is "we do not yet know, and here is what to go and find out" — say that plainly rather than manufacturing a conclusion. Confidence must reflect the evidence you actually received, not the confidence the PM would like to hear.`;

export async function synthesize(session: Session): Promise<Synthesis> {
  const complete = session.streams.filter((s) => s.selected && s.status === "complete");
  const provider = await getProvider();

  if (provider.mode === "live" && complete.length > 0) {
    try {
      return await liveSynthesis(session, complete);
    } catch {
      /* fall through to the structural synthesis */
    }
  }
  return structuralSynthesis(session, complete);
}

interface RawSynthesis {
  headline?: string;
  themes?: { title?: string; body?: string; supportedBy?: string[]; strength?: string }[];
  triangulation?: { insight?: string; sources?: string[]; agreement?: string; strength?: string }[];
  insights?: { insight?: string; soWhat?: string; implication?: string; confidence?: string; supportedBy?: string[] }[];
  opportunities?: { title?: string; hmw?: string; userValue?: string; businessValue?: string; evidence?: string }[];
  contradictions?: string[];
  gaps?: string[];
}

async function liveSynthesis(session: Session, streams: ResearchStream[]): Promise<Synthesis> {
  const provider = await getProvider();
  const d = getDepth(session.plan.depth);

  const blocks = streams
    .map((s) => {
      const name = capabilityName(s.capabilityId);
      const lines: string[] = [`### ${name} (id: ${s.capabilityId})`];
      if (s.summary) lines.push(s.summary);
      if (s.evidence.length) {
        lines.push("Evidence:");
        for (const e of s.evidence) lines.push(`- [${e.type.toUpperCase()} / ${e.strength}] ${e.statement}${e.source ? ` (source: ${e.source})` : ""}`);
      }
      if (s.findings.length) {
        lines.push("Findings:");
        for (const f of s.findings) lines.push(`- [${f.strength}] ${f.title}: ${f.detail}`);
      }
      if (s.patterns.length) lines.push(`Patterns:\n${s.patterns.map((p) => `- ${p}`).join("\n")}`);
      if (s.contradictions.length) lines.push(`Contradictions:\n${s.contradictions.map((p) => `- ${p}`).join("\n")}`);
      if (s.gaps.length) lines.push(`Gaps:\n${s.gaps.map((p) => `- ${p}`).join("\n")}`);
      if (s.implications.length) lines.push(`Implications:\n${s.implications.map((p) => `- ${p}`).join("\n")}`);
      if (s.userNotes) lines.push(`PM note on this lens: ${s.userNotes}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const raw = await provider.generateJson<RawSynthesis>({
    system: SYNTHESIS_SYSTEM,
    prompt: `OBJECTIVE: ${session.plan.objective}
DECISION IN SERVICE OF: ${session.plan.decision}
${session.notes.length ? `\nCONTEXT THE PM ADDED:\n${session.notes.map((n) => `- ${n}`).join("\n")}\n` : ""}
THE STREAMS:

${blocks}

Synthesize ACROSS these streams. Return JSON:
{
  "headline": "the single most decision-relevant takeaway, in one sentence",
  "themes": [ { "title": "…", "body": "what it is and why it holds", "supportedBy": ["<capability id>"], "strength": "Strong|Moderate|Directional|Hypothesis" } ],
  "triangulation": [ { "insight": "a claim that more than one stream bears on", "sources": ["<capability id>"], "agreement": "converging|conflicting|single-source", "strength": "Strong|Moderate|Directional|Hypothesis" } ],
  "insights": [ { "insight": "what we learned", "soWhat": "what the team should therefore do — specific", "implication": "${IMPLICATIONS.join("|")}", "confidence": "High|Medium|Low", "supportedBy": ["<capability id>"] } ],
  "opportunities": [ { "title": "…", "hmw": "How might we …", "userValue": "…", "businessValue": "…", "evidence": "Strong|Moderate|Directional|Hypothesis" } ],
  "contradictions": ["conflicts between streams, stated with both sides and what would settle them"],
  "gaps": ["what we still need to know, and how to get it"]
}

Only include a theme, triangulation row or opportunity that draws on the streams — no generic product wisdom. Order everything by how much it should influence the decision.`,
    maxTokens: d.budget,
  });

  return {
    createdAt: Date.now(),
    headline: String(raw?.headline ?? "").trim() || structuralHeadline(streams),
    themes: (raw?.themes ?? [])
      .filter((t) => t && String(t.title ?? "").trim())
      .map((t) => ({
        title: String(t.title).trim(),
        body: String(t.body ?? "").trim(),
        supportedBy: list(t.supportedBy),
        strength: strength(t.strength),
      })),
    triangulation: (raw?.triangulation ?? [])
      .filter((t) => t && String(t.insight ?? "").trim())
      .map<Triangulation>((t) => ({
        insight: String(t.insight).trim(),
        sources: list(t.sources),
        agreement:
          t.agreement === "conflicting" || t.agreement === "single-source" ? t.agreement : "converging",
        strength: strength(t.strength),
      })),
    insights: (raw?.insights ?? [])
      .filter((i) => i && String(i.insight ?? "").trim())
      .map<Insight>((i, n) => ({
        id: `i${n + 1}`,
        insight: String(i.insight).trim(),
        soWhat: String(i.soWhat ?? "").trim(),
        implication: IMPLICATIONS.includes(i.implication as ImplicationKind) ? (i.implication as ImplicationKind) : "validate",
        confidence: CONFIDENCES.includes(i.confidence as Confidence) ? (i.confidence as Confidence) : "Low",
        supportedBy: list(i.supportedBy),
      })),
    opportunities: (raw?.opportunities ?? [])
      .filter((o) => o && String(o.title ?? "").trim())
      .map<Opportunity>((o, n) => ({
        id: `o${n + 1}`,
        title: String(o.title).trim(),
        hmw: String(o.hmw ?? "").trim(),
        userValue: String(o.userValue ?? "").trim(),
        businessValue: String(o.businessValue ?? "").trim(),
        evidence: strength(o.evidence),
      })),
    contradictions: list(raw?.contradictions),
    gaps: list(raw?.gaps),
  };
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [];
}
function strength(v: unknown): EvidenceStrength {
  return STRENGTHS.find((s) => s.toLowerCase() === String(v ?? "").trim().toLowerCase()) ?? "Hypothesis";
}

/* ---------------------------- structural fallback ------------------------- */

/**
 * Without a live model we can still do real work: the streams' own evidence
 * types, strengths and overlaps are structured data. This computes the parts of
 * synthesis that are mechanical — which claims more than one stream touches,
 * what every stream flagged as a gap, what contradictions were reported — and
 * refuses to invent the parts that require judgement.
 */
function structuralSynthesis(session: Session, streams: ResearchStream[]): Synthesis {
  const contradictions = streams.flatMap((s) =>
    s.contradictions.map((c) => `${capabilityName(s.capabilityId)}: ${c}`)
  );
  const gaps = streams.flatMap((s) => s.gaps.map((g) => `${capabilityName(s.capabilityId)}: ${g}`));

  const themes = streams
    .filter((s) => s.findings.length > 0)
    .map((s) => ({
      title: capabilityName(s.capabilityId),
      body: s.summary || `${s.findings.length} finding(s) reported by this lens.`,
      supportedBy: [s.capabilityId],
      strength: strongest(s),
    }));

  // Mechanical triangulation: a lens that reported gaps for everything agrees
  // with every other lens only about what is missing.
  const allGaps = streams.length > 0 && streams.every((s) => s.evidence.every((e) => e.type === "gap"));
  const triangulation: Triangulation[] = allGaps
    ? [
        {
          insight: "No stream produced verified evidence — every lens reported gaps rather than facts.",
          sources: streams.map((s) => s.capabilityId),
          agreement: "converging",
          strength: "Strong",
        },
      ]
    : themes.map((t) => ({
        insight: t.body,
        sources: t.supportedBy,
        agreement: "single-source" as const,
        strength: t.strength,
      }));

  const insights: Insight[] = streams
    .flatMap((s) =>
      s.implications.map((imp, n) => ({
        id: `${s.capabilityId}-${n}`,
        insight: s.findings[0]?.title ?? `${capabilityName(s.capabilityId)} lens`,
        soWhat: imp,
        implication: "validate" as ImplicationKind,
        confidence: "Low" as Confidence,
        supportedBy: [s.capabilityId],
      }))
    )
    .slice(0, 10);

  return {
    createdAt: Date.now(),
    headline: structuralHeadline(streams),
    themes,
    triangulation,
    insights,
    opportunities: [],
    contradictions,
    gaps: gaps.length ? gaps : ["No gaps were reported — verify that against the evidence before trusting it."],
  };
}

function structuralHeadline(streams: ResearchStream[]): string {
  if (streams.length === 0) return "No research streams have completed yet.";
  const allGaps = streams.every((s) => s.evidence.every((e) => e.type === "gap"));
  if (allGaps) {
    return `Across ${streams.length} lens${streams.length === 1 ? "" : "es"}, no verified evidence exists yet — the honest conclusion is that this question is currently unanswerable, and the gaps below are the work.`;
  }
  const strong = streams.flatMap((s) => s.findings).filter((f) => f.strength === "Strong" || f.strength === "Moderate");
  return strong.length
    ? `${strong.length} well-supported finding(s) across ${streams.length} lenses; the rest is directional and needs validation.`
    : `${streams.length} lens${streams.length === 1 ? "" : "es"} reported, but nothing rises above directional evidence — treat every conclusion as provisional.`;
}

function strongest(s: ResearchStream): EvidenceStrength {
  for (const level of STRENGTHS) if (s.findings.some((f) => f.strength === level)) return level;
  return "Hypothesis";
}
