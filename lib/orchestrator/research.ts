/**
 * LAYER 1 — running the research streams.
 *
 * Selected capabilities run as PARALLEL EVIDENCE STREAMS. Each specialist
 * returns the same six-part contract so the orchestrator can synthesize across
 * them rather than concatenate them:
 *
 *   1. key evidence (each item typed fact / inference / assumption / gap /
 *      contradiction, and graded)
 *   2. key findings
 *   3. patterns
 *   4. contradictions
 *   5. evidence gaps
 *   6. implications
 *
 * Outward-facing lenses (market, competitive, regulatory, ecosystem, trends)
 * do live web research first when a live provider is available.
 */
import { getProvider } from "../llm/provider";
import { getDepth } from "./catalog/depth";
import { getCapability, type ResearchCapability } from "./catalog/research";
import { EVIDENCE_DISCIPLINE } from "./universal";
import type {
  DepthMode,
  EvidenceItem,
  EvidenceStrength,
  EvidenceType,
  Plan,
  ResearchId,
  ResearchStream,
  StreamFinding,
} from "./types";

const STRENGTHS: EvidenceStrength[] = ["Strong", "Moderate", "Directional", "Hypothesis"];
const TYPES: EvidenceType[] = ["fact", "inference", "assumption", "gap", "contradiction"];

export function emptyStream(id: ResearchId, selected: boolean): ResearchStream {
  return {
    capabilityId: id,
    selected,
    status: "pending",
    evidence: [],
    findings: [],
    patterns: [],
    contradictions: [],
    gaps: [],
    implications: [],
    sources: [],
  };
}

/** Everything a specialist is told about the session before it starts. */
export function briefFor(plan: Plan, input: string, notes: string[]): string {
  const answered = plan.clarifications.filter((c) => c.answer.trim());
  return [
    `OBJECTIVE: ${plan.objective}`,
    `DECISION IN SERVICE OF: ${plan.decision}`,
    `SCOPE: ${plan.scope}`,
    `STAKEHOLDERS: ${plan.stakeholders}`,
    `EVIDENCE THE PM ALREADY HAS: ${plan.existingEvidence}`,
    plan.assumptions.length ? `ASSUMPTIONS IN FORCE (treat as assumptions, not facts):\n${plan.assumptions.map((a) => `- ${a}`).join("\n")}` : "",
    answered.length ? `THE PM CLARIFIED:\n${answered.map((c) => `- ${c.question} → ${c.answer}`).join("\n")}` : "",
    notes.length ? `CONTEXT THE PM ADDED:\n${notes.map((n) => `- ${n}`).join("\n")}` : "",
    `\nTHE ORIGINAL REQUEST:\n"""\n${input.slice(0, 6000)}\n"""`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runStream(
  capabilityId: ResearchId,
  brief: string,
  depth: DepthMode,
  userNotes?: string
): Promise<Omit<ResearchStream, "capabilityId" | "selected" | "status">> {
  const cap = getCapability(capabilityId);
  if (!cap) throw new Error(`Unknown research capability: ${capabilityId}`);
  const provider = await getProvider();

  if (provider.mode === "live") {
    return runLive(cap, brief, depth, userNotes);
  }
  return demoStream(cap, depth);
}

interface RawStream {
  summary?: string;
  evidence?: { statement?: string; type?: string; strength?: string; source?: string }[];
  findings?: { title?: string; detail?: string; strength?: string }[];
  patterns?: string[];
  contradictions?: string[];
  gaps?: string[];
  implications?: string[];
}

async function runLive(
  cap: ResearchCapability,
  brief: string,
  depth: DepthMode,
  userNotes?: string
): Promise<Omit<ResearchStream, "capabilityId" | "selected" | "status">> {
  const provider = await getProvider();
  const d = getDepth(depth);
  const sources: string[] = [];

  // Outward-facing lenses get live web research first.
  let researchBlock = "";
  if (cap.research && typeof provider.research === "function") {
    try {
      const found = await provider.research(researchQuery(cap, brief));
      if (found && found.trim()) {
        researchBlock = `\n\nLIVE WEB RESEARCH (ground your factual claims in this and cite it; anything not here is NOT a fact):\n${found.trim()}\n`;
        for (const m of found.matchAll(/https?:\/\/[^\s)\]]+/g)) sources.push(m[0]);
      }
    } catch {
      /* research is best-effort */
    }
  }

  const [min, max] = d.findings;
  const raw = await provider.generateJson<RawStream>({
    system: `${EVIDENCE_DISCIPLINE}\n\n---\n\nYOUR LENS:\n${cap.system}`,
    prompt: `${brief}
${userNotes ? `\nTHE PM ADDED, FOR THIS LENS SPECIFICALLY:\n${userNotes}\n` : ""}${researchBlock}
Work your lens and report back. Return JSON:
{
  "summary": "2-3 sentences: what this lens shows, and how confident you are overall",
  "evidence": [ { "statement": "…", "type": "fact|inference|assumption|gap|contradiction", "strength": "Strong|Moderate|Directional|Hypothesis", "source": "where it came from, or how it was inferred" } ],
  "findings": [ { "title": "short, specific", "detail": "what it means and what follows from it", "strength": "Strong|Moderate|Directional|Hypothesis" } ],
  "patterns": ["patterns across the evidence, not restatements of it"],
  "contradictions": ["evidence that conflicts with other evidence, or with the PM's framing"],
  "gaps": ["important things still unknown, and what would resolve each"],
  "implications": ["what the product team should DO differently because of this — specific actions, not themes"]
}

Give ${min}-${max} findings. Include gap-type evidence honestly: if you have no real data for this lens, most of your evidence should be typed "gap" and your findings should be few and marked "Hypothesis". An honest thin report beats a padded confident one.`,
    maxTokens: d.budget,
  });

  return {
    summary: String(raw?.summary ?? "").trim(),
    evidence: (raw?.evidence ?? [])
      .filter((e) => e && String(e.statement ?? "").trim())
      .map((e, i) => ({
        id: `e${i + 1}`,
        statement: String(e.statement).trim(),
        type: normType(e.type),
        strength: normStrength(e.strength),
        source: e.source ? String(e.source).trim() : undefined,
      })),
    findings: (raw?.findings ?? [])
      .filter((f) => f && String(f.title ?? "").trim())
      .map((f, i) => ({
        id: `f${i + 1}`,
        title: String(f.title).trim().slice(0, 180),
        detail: String(f.detail ?? "").trim(),
        strength: normStrength(f.strength),
      })),
    patterns: strList(raw?.patterns),
    contradictions: strList(raw?.contradictions),
    gaps: strList(raw?.gaps),
    implications: strList(raw?.implications),
    sources: [...new Set(sources)].slice(0, 12),
    userNotes,
    ranAt: Date.now(),
  };
}

function researchQuery(cap: ResearchCapability, brief: string): string {
  const topic = brief.replace(/\s+/g, " ").slice(0, 900);
  switch (cap.id) {
    case "market_category":
      return `Find current, sourced market data for this product context: category definition, market size and growth, segments, and demand drivers. Give figures only with the source and its date.\n\nCONTEXT: ${topic}`;
    case "competitive":
      return `Identify the specific companies, products and manual alternatives customers use for this today. For each: what it does, who it serves, pricing if published, and customer sentiment. Cite sources.\n\nCONTEXT: ${topic}`;
    case "domain_regulatory":
      return `Identify the specific regulations, standards and compliance obligations that apply here, by name and jurisdiction, including privacy, security and accessibility. Cite the regulator or standards body.\n\nCONTEXT: ${topic}`;
    case "ecosystem_integration":
      return `Identify the platforms, marketplaces, data providers, partners and integrations relevant to this, and any published constraints on their APIs or terms. Cite sources.\n\nCONTEXT: ${topic}`;
    case "trend_foresight":
      return `Find current, dated signals of change relevant to this: emerging technology, regulatory direction, startup and funding activity, and shifting customer behaviour. Distinguish observed signals from predictions. Cite sources.\n\nCONTEXT: ${topic}`;
    default:
      return `Find current, factual, sourced context relevant to: ${topic}`;
  }
}

function normStrength(s: unknown): EvidenceStrength {
  const hit = STRENGTHS.find((x) => x.toLowerCase() === String(s ?? "").trim().toLowerCase());
  return hit ?? "Hypothesis";
}
function normType(s: unknown): EvidenceType {
  const hit = TYPES.find((x) => x === String(s ?? "").trim().toLowerCase());
  return hit ?? "assumption";
}
function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 10) : [];
}

/* ------------------------------- demo mode -------------------------------- */

/**
 * With no API key there is no evidence to report — so demo mode does NOT invent
 * findings. It returns the honest shape of the stream: what this lens would
 * investigate, which sources it would need, and every one of those marked as a
 * gap. That is the behaviour the evidence discipline demands, and it makes the
 * structure of the product legible without fabricating a single claim.
 */
function demoStream(cap: ResearchCapability, depth: DepthMode): Omit<ResearchStream, "capabilityId" | "selected" | "status"> {
  const [, max] = getDepth(depth).findings;
  const evidence: EvidenceItem[] = cap.investigates.slice(0, max).map((q, i) => ({
    id: `e${i + 1}`,
    statement: `${q} — not yet established for this request.`,
    type: "gap" as EvidenceType,
    strength: "Hypothesis" as EvidenceStrength,
    source: "No source supplied (demo mode: no live research was run).",
  }));
  const findings: StreamFinding[] = [
    {
      id: "f1",
      title: `No ${cap.name.toLowerCase()} evidence has been gathered yet`,
      detail: `This lens needs ${cap.sources.slice(0, 3).join(", ").toLowerCase()}. Demo mode does not fabricate findings, so nothing is asserted here. Set ANTHROPIC_API_KEY to run this lens live, or paste the evidence you already have into the session and re-run.`,
      strength: "Hypothesis",
    },
  ];
  return {
    summary: `Demo mode — no live research was run for the ${cap.name} lens. Rather than invent findings, this stream reports what it would investigate and marks all of it as an evidence gap.`,
    evidence,
    findings,
    patterns: [],
    contradictions: [],
    gaps: cap.investigates.map((q) => `${q} — would be resolved by: ${cap.sources[0]?.toLowerCase() ?? "primary research"}.`),
    implications: [`Before acting on this lens, obtain: ${cap.sources.join("; ").toLowerCase()}.`],
    sources: [],
    ranAt: Date.now(),
  };
}
