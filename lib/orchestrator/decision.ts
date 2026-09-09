/**
 * LAYER 3 / STEP 7 — help the PM actually decide.
 *
 * Everything before this produces understanding. This produces a call:
 *
 *   Evidence → Insight → Options → Trade-offs → Recommendation
 *   → Confidence → Evidence gaps
 *
 * Two rules matter more than the rest: a "do nothing / keep the status quo"
 * option is always on the table, and confidence is reported honestly. The
 * system does not fabricate certainty — a Low-confidence recommendation with
 * named gaps is a legitimate and often correct output.
 */
import { getProvider } from "../llm/provider";
import { getAudience, getDepth } from "./catalog/depth";
import { evidenceDossier } from "./dossier";
import { EVIDENCE_DISCIPLINE } from "./universal";
import type { Confidence, DecisionBrief, DecisionOption, Session } from "./types";

const CONFIDENCES: Confidence[] = ["High", "Medium", "Low"];

const DECISION_SYSTEM = `${EVIDENCE_DISCIPLINE}

---

You are the ORCHESTRATOR turning synthesized evidence into a decision a product manager can act on.

Structure, in this order: what we know (evidence) → what it means (insight) → what could be done (options) → what each costs (trade-offs) → what we should do (recommendation) → how sure we are (confidence) → what to validate next (gaps).

Rules:
- ALWAYS include a "do nothing / keep the status quo" option and cost it honestly. It is frequently the right answer and is the baseline every other option must beat.
- Options must be genuinely different paths, not the same path at three sizes. If you can only see one real option, say so and explain why the others collapse.
- Trade-offs must include what is GIVEN UP, not just what is gained. An option with no downside has not been analysed.
- Confidence must match the evidence. If the streams reported mostly gaps, the confidence is Low and the honest recommendation may be "run this specific research before committing" — that is a real recommendation, not a punt, so make it concrete: name what to find out, how, and what result would change the call.
- Do not fabricate certainty, numbers or consensus. Never let the recommendation imply more evidence than the dossier contains.`;

export async function decide(session: Session): Promise<DecisionBrief> {
  const provider = await getProvider();
  if (provider.mode === "live") {
    try {
      return await live(session);
    } catch {
      /* fall through */
    }
  }
  return structural(session);
}

interface RawDecision {
  evidence?: string[];
  insight?: string;
  options?: { name?: string; description?: string; benefits?: string; costs?: string; risks?: string; effort?: string }[];
  recommendation?: string;
  rationale?: string;
  confidence?: string;
  gaps?: string[];
  nextSteps?: string[];
}

async function live(session: Session): Promise<DecisionBrief> {
  const provider = await getProvider();
  const depth = getDepth(session.plan.depth);
  const audience = getAudience(session.plan.audience);

  const raw = await provider.generateJson<RawDecision>({
    system: DECISION_SYSTEM,
    prompt: `${evidenceDossier(session)}

${depth.directive}
${audience.directive}

Produce the decision. Return JSON:
{
  "evidence": ["what we know — only what the dossier supports, each phrased so its strength is visible"],
  "insight": "what it means, in one short paragraph",
  "options": [ { "name": "…", "description": "…", "benefits": "…", "costs": "…", "risks": "…", "effort": "…" } ],
  "recommendation": "what we should do — specific and actionable",
  "rationale": "why this over the alternatives",
  "confidence": "High|Medium|Low",
  "gaps": ["what should be validated next, and how"],
  "nextSteps": ["concrete next actions in order"]
}

Include a do-nothing option. Give 2-4 options total.`,
    maxTokens: depth.budget,
  });

  const options: DecisionOption[] = (raw?.options ?? [])
    .filter((o) => o && String(o.name ?? "").trim())
    .map((o) => ({
      name: String(o.name).trim(),
      description: String(o.description ?? "").trim(),
      benefits: String(o.benefits ?? "").trim(),
      costs: String(o.costs ?? "").trim(),
      risks: String(o.risks ?? "").trim(),
      effort: String(o.effort ?? "").trim(),
    }));

  const brief: DecisionBrief = {
    createdAt: Date.now(),
    evidence: list(raw?.evidence),
    insight: String(raw?.insight ?? "").trim(),
    options,
    recommendation: String(raw?.recommendation ?? "").trim(),
    rationale: String(raw?.rationale ?? "").trim(),
    confidence: CONFIDENCES.includes(raw?.confidence as Confidence) ? (raw!.confidence as Confidence) : "Low",
    gaps: list(raw?.gaps),
    nextSteps: list(raw?.nextSteps),
  };
  return brief.recommendation ? brief : structural(session);
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [];
}

/**
 * With no live model, the honest decision is the one the evidence supports:
 * gather the evidence first. This is assembled from the real gaps in the
 * session rather than invented.
 */
function structural(session: Session): DecisionBrief {
  const streams = session.streams.filter((s) => s.selected && s.status === "complete");
  const gaps = [
    ...(session.synthesis?.gaps ?? []),
    ...streams.flatMap((s) => s.gaps),
    ...session.plan.clarifications.filter((c) => !c.answer.trim()).map((c) => c.question),
  ].slice(0, 10);

  const evidence = streams.flatMap((s) => s.findings.map((f) => `[${f.strength}] ${f.title}`)).slice(0, 10);

  return {
    createdAt: Date.now(),
    evidence: evidence.length ? evidence : ["No verified evidence has been gathered in this session."],
    insight:
      session.synthesis?.headline ??
      "There is not yet enough evidence in this session to draw a conclusion. Saying so is the correct output; a confident recommendation here would be fabricated.",
    options: [
      {
        name: "Do nothing for now",
        description: "Keep the status quo and revisit when evidence exists.",
        benefits: "No investment, no opportunity cost against better-evidenced work.",
        costs: "The problem described continues, at whatever it currently costs.",
        risks: "If the problem is real and growing, delay compounds it.",
        effort: "None.",
      },
      {
        name: "Gather the missing evidence first",
        description: `Run the research this session identified as missing before committing to a build: ${gaps.slice(0, 3).join("; ") || "the gaps listed below"}.`,
        benefits: "Turns a guess into a decision; cheap relative to building the wrong thing.",
        costs: "Delays a decision by the length of the research.",
        risks: "Low — the main risk is over-researching a small decision.",
        effort: "Small to moderate.",
      },
    ],
    recommendation:
      "Gather the missing evidence before committing. This session has not produced enough verified evidence to recommend a build, and a recommendation made on this basis would be a guess wearing a framework.",
    rationale:
      session.mode === "demo"
        ? "The app is in demo mode, so no live research or analysis was performed. Set ANTHROPIC_API_KEY to run the streams live, or paste the evidence you already have into the session and re-run."
        : "The completed streams reported gaps rather than verified findings.",
    confidence: "Low",
    gaps: gaps.length ? gaps : ["Nothing was flagged as a gap — verify that against the evidence before trusting it."],
    nextSteps: [
      "Answer any open clarifying questions on the plan.",
      "Supply or run the research the streams flagged as missing.",
      "Re-run synthesis, then return to this decision.",
    ],
  };
}
