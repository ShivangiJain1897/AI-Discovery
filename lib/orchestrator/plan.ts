/**
 * STEPS 1–4 + 10 — understand the question, then recommend the package.
 *
 * The PM types a product question. Before anything runs, the orchestrator:
 *   1. states back the objective, the decision, the users, the scope, what
 *      evidence already exists and who consumes the output;
 *   2. asks at most 3–5 clarifying questions — and ONLY where a different
 *      answer would change the research, the analysis or the recommendation;
 *   3. recommends research capabilities, analysis methods and outputs, each
 *      with the reason it is there, split into required vs optional;
 *   4. picks a depth and an audience.
 *
 * The PM can accept it wholesale or change any part. If the intent is obvious,
 * the UI proceeds without making them do anything.
 */
import { getProvider } from "../llm/provider";
import { ANALYSIS_METHODS, getMethod } from "./catalog/analysis";
import { OUTPUTS, getOutput } from "./catalog/outputs";
import { RESEARCH_CAPABILITIES, getCapability } from "./catalog/research";
import { EVIDENCE_DISCIPLINE } from "./universal";
import type { AudienceId, Clarification, DepthMode, InputType, Plan, PlanItem } from "./types";

const INPUT_TYPES: InputType[] = [
  "problem", "question", "idea", "solution", "requirement", "decision", "transcript", "data",
];

const PLANNER_SYSTEM = `${EVIDENCE_DISCIPLINE}

---

You are the ORCHESTRATOR. You do not do the research yourself. You read a product manager's request and decide what combination of research, analysis, decision support and artifacts will actually answer it.

Keep the four layers separate and never confuse them:
  RESEARCH   — what evidence must be discovered (e.g. competitive research, user interviews)
  ANALYSIS   — what reasoning is applied to that evidence (e.g. SWOT, RICE, root cause)
  DECISION   — what recommendation should emerge (e.g. prioritize A over B)
  GENERATION — what artifact the PM needs (e.g. a PRD, a backlog, an executive summary)

Rules for the package you recommend:
- Recommend what the QUESTION needs, not everything available. Four well-chosen research lenses beat eleven shallow ones. A request that is purely a framing question may need one lens and one method.
- Mark a capability REQUIRED only if the conclusion would be unsound without it. Everything else is optional.
- Never pick a prioritization framework because it is popular. Pick the one the available evidence can support: RICE needs real reach data; without it use ICE or impact-effort and say why.
- Give a specific reason for every item. "Useful context" is not a reason; "the request assumes members will switch, and nothing here tests that" is.

Rules for clarifying questions:
- Ask ONLY where a different answer would materially change the research, the analysis or the recommendation. Most requests need zero or one.
- Never ask what you can sensibly infer. Infer it, record it as a labelled assumption, and move on.
- Never ask more than five. Three is usually too many.

Restate the objective in the PM's own domain language, sharpened. If the request contains a hidden solution ("we should build X"), name the underlying problem X is meant to solve — and say that you have done so.`;

export interface PlanContext {
  input: string;
  inputType: InputType;
}

/** Classify what kind of input this is. */
export async function classifyInput(input: string): Promise<InputType> {
  const provider = await getProvider();
  if (provider.mode === "live") {
    try {
      const raw = await provider.generateJson<{ type?: string }>({
        system: "You classify a product manager's input by what kind of thing it is.",
        prompt: `Classify as exactly one of: ${INPUT_TYPES.join(", ")}.
- "problem": a pain or gap
- "question": an open question to investigate
- "idea": a possible thing to build
- "solution": a proposed approach already chosen
- "requirement": a spec or user story
- "decision": an explicit choice to make between options
- "transcript": a call/interview to mine
- "data": a dataset, metrics dump or ticket export

Return JSON { "type": "<one>" }.

INPUT:
"""
${input.slice(0, 3000)}
"""`,
        maxTokens: 40,
      });
      const t = (raw?.type || "").toLowerCase() as InputType;
      if (INPUT_TYPES.includes(t)) return t;
    } catch {
      /* fall through to heuristic */
    }
  }
  return heuristicType(input);
}

function heuristicType(input: string): InputType {
  const t = input.toLowerCase();
  const lines = input.split(/\r?\n/).filter((l) => l.trim()).length;
  if (lines >= 6 && /(^|\n)\s*[A-Z][a-zA-Z ]{1,20}\s*:/.test(input)) return "transcript";
  if (/\b(vs\.?|versus|either|or should we|a or b|prioriti[sz]e .* over|choose between|trade.?off)\b/.test(t)) return "decision";
  if (/\b(as a|i want|so that|acceptance criteria|shall|must have)\b/.test(t)) return "requirement";
  if (/\b(we should build|let's build|implement|roll out|launch a|build a)\b/.test(t)) return "solution";
  if (/\b(what if|idea:|maybe we|could we|concept|explore)\b/.test(t)) return "idea";
  if (/^(why|what|how|who|where|when|should|is|are|do|does|can)\b/.test(t.trim()) || t.includes("?")) return "question";
  if (/\b(can't|cannot|problem|issue|struggle|pain|fails|broken|frustrat|drop|churn|complain)\b/.test(t)) return "problem";
  return "problem";
}

/** Build the recommended package for this request. */
export async function buildPlan(ctx: PlanContext): Promise<Plan> {
  const provider = await getProvider();
  if (provider.mode === "live") {
    try {
      return await livePlan(ctx);
    } catch {
      /* a failed plan must never dead-end the session */
    }
  }
  return heuristicPlan(ctx);
}

interface RawPlan {
  objective?: string;
  decision?: string;
  stakeholders?: string;
  scope?: string;
  existingEvidence?: string;
  consumer?: string;
  assumptions?: string[];
  depth?: string;
  audience?: string;
  clarifications?: { question?: string; why?: string }[];
  research?: { id?: string; required?: boolean; why?: string }[];
  analysis?: { id?: string; required?: boolean; why?: string }[];
  outputs?: { id?: string; required?: boolean; why?: string }[];
}

async function livePlan(ctx: PlanContext): Promise<Plan> {
  const provider = await getProvider();
  const capList = RESEARCH_CAPABILITIES.map((c) => `- ${c.id} (${c.letter}. ${c.name}): ${c.blurb}`).join("\n");
  const methodList = ANALYSIS_METHODS.map((m) => `- ${m.id} (${m.name}): ${m.blurb} [needs: ${m.evidenceNeeded}]`).join("\n");
  const outputList = OUTPUTS.map((o) => `- ${o.id} (${o.name}): ${o.blurb}`).join("\n");

  const raw = await provider.generateJson<RawPlan>({
    system: PLANNER_SYSTEM,
    prompt: `A product manager brought you this (classified as a ${ctx.inputType}):
"""
${ctx.input.slice(0, 8000)}
"""

RESEARCH CAPABILITIES AVAILABLE (Layer 1):
${capList}

ANALYSIS METHODS AVAILABLE (Layer 2):
${methodList}

OUTPUTS AVAILABLE (Layer 4):
${outputList}

DEPTH MODES: quick | standard | deep | executive | working
AUDIENCES: product_team | engineering | design | leadership | customer | sales | operations | compliance | executive

Return JSON:
{
  "objective": "I understand the objective as: … (one or two sentences, in their domain language)",
  "decision": "the decision this is really in service of",
  "stakeholders": "the users / customers / buyers / stakeholders in scope",
  "scope": "the product, feature, workflow or market in scope",
  "existingEvidence": "what evidence they already appear to have (or 'none stated')",
  "consumer": "who will consume the final output",
  "assumptions": ["defaults you inferred, each phrased as an assumption"],
  "depth": "<depth mode>",
  "audience": "<audience>",
  "clarifications": [ { "question": "…", "why": "what changes depending on the answer" } ],
  "research": [ { "id": "<capability id>", "required": true, "why": "specific reason" } ],
  "analysis": [ { "id": "<method id>", "required": true, "why": "specific reason" } ],
  "outputs": [ { "id": "<output id>", "required": true, "why": "specific reason" } ]
}

Use ONLY ids from the lists above. Recommend 2-6 research capabilities, 2-5 analysis methods and 1-3 outputs. Include 0-5 clarifications, and prefer zero.`,
    maxTokens: 2600,
  });

  return normalizePlan(raw, ctx);
}

function normalizePlan(raw: RawPlan, ctx: PlanContext): Plan {
  const fallback = heuristicPlan(ctx);

  const items = (
    list: { id?: string; required?: boolean; why?: string }[] | undefined,
    exists: (id: string) => boolean,
    fb: PlanItem[]
  ): PlanItem[] => {
    const seen = new Set<string>();
    const out: PlanItem[] = [];
    for (const r of list ?? []) {
      const id = String(r?.id ?? "").trim();
      if (!id || seen.has(id) || !exists(id)) continue;
      seen.add(id);
      out.push({ id, required: r.required !== false, why: String(r.why ?? "").trim(), selected: true });
    }
    return out.length ? out : fb;
  };

  const depth = (["quick", "standard", "deep", "executive", "working"] as DepthMode[]).includes(raw.depth as DepthMode)
    ? (raw.depth as DepthMode)
    : fallback.depth;
  const audience = (
    ["product_team", "engineering", "design", "leadership", "customer", "sales", "operations", "compliance", "executive"] as AudienceId[]
  ).includes(raw.audience as AudienceId)
    ? (raw.audience as AudienceId)
    : fallback.audience;

  const clarifications: Clarification[] = (raw.clarifications ?? [])
    .filter((c) => c && String(c.question ?? "").trim())
    .slice(0, 5)
    .map((c, i) => ({
      id: `q${i + 1}`,
      question: String(c.question).trim(),
      why: String(c.why ?? "").trim(),
      answer: "",
    }));

  return {
    objective: str(raw.objective) || fallback.objective,
    decision: str(raw.decision) || fallback.decision,
    stakeholders: str(raw.stakeholders) || fallback.stakeholders,
    scope: str(raw.scope) || fallback.scope,
    existingEvidence: str(raw.existingEvidence) || fallback.existingEvidence,
    consumer: str(raw.consumer) || fallback.consumer,
    assumptions: (raw.assumptions ?? []).map(str).filter(Boolean).slice(0, 8),
    depth,
    audience,
    clarifications,
    research: items(raw.research, (id) => Boolean(getCapability(id)), fallback.research),
    analysis: items(raw.analysis, (id) => Boolean(getMethod(id)), fallback.analysis),
    outputs: items(raw.outputs, (id) => Boolean(getOutput(id)), fallback.outputs),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/* ------------------------- deterministic fallback ------------------------- */

/**
 * Demo-mode / fallback planning. Keyword-triggered, but it follows the same
 * rules: pick what the question needs, say why, and never pretend a method has
 * evidence it doesn't.
 */
export function heuristicPlan(ctx: PlanContext): Plan {
  const t = ctx.input.toLowerCase();
  const clip = ctx.input.trim().replace(/\s+/g, " ").slice(0, 180);

  /* --- research: whichever lenses the text actually implicates --- */
  const research: PlanItem[] = [];
  // A later "required" call upgrades an item the keyword sweep already added as
  // optional — and takes its more specific reason with it.
  const add = (id: string, required: boolean, why: string) => {
    const existing = research.find((r) => r.id === id);
    if (!existing) {
      research.push({ id, required, why, selected: true });
    } else if (required && !existing.required) {
      existing.required = true;
      existing.why = why;
    }
  };

  for (const cap of RESEARCH_CAPABILITIES) {
    if (cap.triggers.test(t)) {
      add(cap.id, false, `The request explicitly touches ${cap.name.toLowerCase()} — ${cap.blurb.toLowerCase()}`);
    }
  }
  // Almost every product question needs the user lens; most need one outside view.
  add("voice_of_customer", true, "Nothing here can be judged without knowing what users are actually trying to do and where it hurts.");
  if (ctx.inputType === "solution" || ctx.inputType === "idea") {
    add("competitive", true, "The request proposes a solution; the alternatives customers already have decide whether it is worth building.");
    add("technology_feasibility", false, "A proposed solution needs a feasibility and data-availability read before it is committed to.");
  }
  if (ctx.inputType === "problem" || ctx.inputType === "question") {
    add("product_behavior", true, "The stated problem needs behavioural evidence to confirm it is real and to locate where it happens.");
    add("quality_support", false, "Support and defect signals often explain a problem that looks like a design issue.");
  }
  if (ctx.inputType === "decision") {
    add("buyer_commercial", false, "A choice between options usually turns on commercial impact, not user preference alone.");
  }
  research.sort((a, b) => Number(b.required) - Number(a.required));
  const trimmed = research.slice(0, 6);

  /* --- analysis: match methods to the evidence we will actually have --- */
  const analysis: PlanItem[] = [];
  const addM = (id: string, required: boolean, why: string) => {
    const existing = analysis.find((m) => m.id === id);
    if (!existing) analysis.push({ id, required, why, selected: true });
    else if (required && !existing.required) { existing.required = true; existing.why = why; }
  };
  addM("problem_framing", true, "Before anything else, separate the stated symptom from the underlying problem.");
  if (/why|cause|drop|fail|churn|decline|regress/.test(t)) {
    addM("root_cause", true, "The question is causal — competing explanations need ranking against evidence, not assertion.");
  }
  if (trimmed.some((r) => r.id === "voice_of_customer")) {
    addM("jtbd", false, "Turns raw user evidence into the progress users are trying to make.");
  }
  if (trimmed.some((r) => r.id === "product_behavior")) {
    addM("funnel", false, "Locates where in the flow the loss actually occurs.");
  }
  if (trimmed.some((r) => r.id === "competitive")) {
    addM("competitive_landscape", true, "Positions the idea against every alternative, including doing nothing.");
  }
  if (ctx.inputType === "decision" || /prioriti|first|which|choose|vs\b/.test(t)) {
    addM("impact_effort", true, "With no reach data yet, impact-effort is the honest triage; upgrade to RICE once usage data exists.");
  }
  addM("product_risk", false, "Surfaces what would have to be true for this to work.");
  const analysisTrim = analysis.slice(0, 5);

  /* --- outputs: what the PM plausibly needs to hand someone --- */
  const outputs: PlanItem[] = [];
  const addO = (id: string, required: boolean, why: string) => {
    if (!outputs.some((o) => o.id === id)) outputs.push({ id, required, why, selected: true });
  };
  if (ctx.inputType === "decision") {
    addO("recommendation_memo", true, "The request is a decision — it needs a recommendation with the reasoning attached.");
  } else if (ctx.inputType === "requirement" || ctx.inputType === "solution") {
    addO("prd_feature", true, "A defined solution needs a specification a team could build from.");
  } else {
    addO("opportunity_brief", true, "Frames what was found as an opportunity the organisation can act on.");
  }
  addO("executive_summary", false, "A one-page version for anyone who will not read the full analysis.");

  // Word-bounded: "onboarding" must not read as a request for the board.
  const audience: AudienceId = /\b(exec|execs|executive|board|leadership|cfo|ceo|cto)\b/.test(t)
    ? "leadership"
    : "product_team";
  const depth: DepthMode = /\b(quick|fast|brief|tl;?dr)\b/.test(t) ? "quick" : "standard";

  return {
    objective: `Understand and act on: “${clip}”`,
    decision:
      ctx.inputType === "decision"
        ? "Which option to pursue, and on what evidence."
        : ctx.inputType === "solution" || ctx.inputType === "idea"
          ? "Whether this is worth building, and in what form."
          : "What to do about the problem described, and what to do first.",
    stakeholders: "Not stated — to be confirmed with the PM.",
    scope: clip,
    existingEvidence: "None stated in the request.",
    consumer: audience === "leadership" ? "Leadership" : "The product team",
    assumptions: [
      "Assumed the request is about the product described, in its current market, unless told otherwise.",
      "Assumed no existing research or analytics were supplied; every quantitative claim will be flagged as a gap rather than estimated.",
    ],
    depth,
    audience,
    clarifications: [],
    research: trimmed,
    analysis: analysisTrim,
    outputs,
  };
}
