/**
 * Intake Analyst — the AI triage copilot.
 *
 * Given a use case, it produces a standardized "idea record": an executive
 * summary, value-stream classification, problem/outcome, stated & unstated
 * assumptions, missing-info questions, related work, an AI-fit assessment, a
 * risk overlay, and a PROVISIONAL RICE-A score with per-factor evidence,
 * assumptions, confidence, and the question that would improve it.
 *
 * It RECOMMENDS and EXPLAINS; humans decide (see the override + decision flow).
 * Live mode uses Claude with an editable prompt; demo mode uses a deterministic
 * generator so it's fully usable with no API key. The RICE-A score is always
 * computed server-side from the factors so a hallucinated total can't slip in.
 */
import { getProvider } from "../llm/provider";
import { getEffectivePrompt } from "../capabilities/prompt-store";
import { findSimilar } from "./similarity";
import { listUseCases } from "./store";
import type { Confidence, IdeaRecord, RiceA, RiceFactor, UseCase } from "./types";

/** RICE-A = (Reach × Impact × Confidence) / (Effort × (AI Complexity / 2)). */
export function computeRice(r: {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  aiComplexity: number;
}): number {
  const effort = Math.max(0.5, r.effort);
  const complexity = Math.max(0.5, r.aiComplexity);
  const score = (r.reach * r.impact * r.confidence) / (effort * (complexity / 2));
  return Math.round(score * 100) / 100;
}

export async function runIntakeAnalysis(uc: UseCase): Promise<IdeaRecord> {
  const provider = await getProvider();
  const all = await listUseCases();
  const related = findSimilar(
    { title: uc.title, problem: uc.problem, area: uc.area, tags: uc.tags },
    all,
    { excludeId: uc.id, threshold: 0.15, limit: 5 }
  ).map((m) => `${m.title} (${Math.round(m.score * 100)}% overlap)`);

  if (provider.mode === "live") {
    try {
      return await runLive(uc, related);
    } catch {
      // fall back to deterministic so the button never dead-ends
    }
  }
  return buildDemo(uc, related);
}

/* -------------------------------- Live path -------------------------------- */

const SHAPE = `Return ONE JSON object of this exact shape:
{
  "executiveSummary": string,               // 5-8 sentences
  "valueStream": { "primary": string, "secondary": string },
  "problemStatement": string,
  "desiredOutcome": string,
  "assumptions": { "stated": string[], "unstated": string[] },
  "missingInfo": string[],                  // questions for the requester
  "related": string[],                      // related use cases / platforms / data / components
  "aiFit": { "pattern": string, "rationale": string },  // AI | rules automation | analytics/BI | workflow redesign | knowledge management | other
  "risk": { "level": "low"|"moderate"|"high", "requiredReviews": string[] },
  "riceA": {
    "reach":        { "score": number, "evidence": string, "assumption": string, "confidence": "low"|"medium"|"high", "question": string },
    "impact":       { "score": number, "evidence": string, "assumption": string, "confidence": "low"|"medium"|"high", "question": string },
    "confidence":   { "score": number, "evidence": string, "assumption": string, "confidence": "low"|"medium"|"high", "question": string },
    "effort":       { "score": number, "evidence": string, "assumption": string, "confidence": "low"|"medium"|"high", "question": string },
    "aiComplexity": { "score": number, "evidence": string, "assumption": string, "confidence": "low"|"medium"|"high", "question": string }
  }
}
Guidance on RICE-A factor scores: Reach = people/teams affected (a count). Impact = 0.25 (minimal) to 3 (massive). Confidence (the RICE factor) = a probability 0..1. Effort = person-months. AI Complexity = 1 (simple) to 5 (very hard). Every early idea is provisional — set factor confidence honestly, usually low.`;

async function runLive(uc: UseCase, related: string[]): Promise<IdeaRecord> {
  const provider = await getProvider();
  const def = await getEffectivePrompt("intake_analyst");
  const prompt = `USE CASE
Title: ${uc.title}
Problem: ${uc.problem || "(none)"}
Area: ${uc.area}
Platform: ${uc.platform || "(unknown)"}
Data: ${uc.dataSources || "(unknown)"}
Business stakeholder: ${uc.businessStakeholder || "(unknown)"}
Technology stakeholder: ${uc.techStakeholder || "(unknown)"}
Data stakeholder: ${uc.dataStakeholder || "(unknown)"}
System-detected related use cases: ${related.length ? related.join("; ") : "(none found)"}

${def.task}

${SHAPE}`;

  const raw = await provider.generateJson<Partial<IdeaRecord>>({
    system: def.system,
    prompt,
    maxTokens: 3000,
  });
  return normalize(raw, related, "live");
}

function normalize(raw: Partial<IdeaRecord>, related: string[], mode: "live" | "demo"): IdeaRecord {
  const rice = raw.riceA as Partial<RiceA> | undefined;
  const f = (x: Partial<RiceFactor> | undefined, fallback: number): RiceFactor => ({
    score: typeof x?.score === "number" ? x.score : fallback,
    evidence: x?.evidence || "—",
    assumption: x?.assumption || "—",
    confidence: normConf(x?.confidence),
    question: x?.question || "—",
  });
  const reach = f(rice?.reach, 3);
  const impact = f(rice?.impact, 2);
  const confidence = f(rice?.confidence, 0.5);
  const effort = f(rice?.effort, 3);
  const aiComplexity = f(rice?.aiComplexity, 3);
  const score = computeRice({
    reach: reach.score,
    impact: impact.score,
    confidence: confidence.score,
    effort: effort.score,
    aiComplexity: aiComplexity.score,
  });
  return {
    provisional: true,
    executiveSummary: String(raw.executiveSummary || ""),
    valueStream: {
      primary: raw.valueStream?.primary || "Unclassified",
      secondary: raw.valueStream?.secondary || undefined,
    },
    problemStatement: String(raw.problemStatement || ""),
    desiredOutcome: String(raw.desiredOutcome || ""),
    assumptions: {
      stated: arr(raw.assumptions?.stated),
      unstated: arr(raw.assumptions?.unstated),
    },
    missingInfo: arr(raw.missingInfo),
    related: raw.related?.length ? arr(raw.related) : related,
    aiFit: { pattern: raw.aiFit?.pattern || "Other", rationale: raw.aiFit?.rationale || "" },
    risk: {
      level: (["low", "moderate", "high"] as const).includes(raw.risk?.level as never)
        ? (raw.risk!.level as IdeaRecord["risk"]["level"])
        : "moderate",
      requiredReviews: arr(raw.risk?.requiredReviews),
    },
    riceA: { reach, impact, confidence, effort, aiComplexity, score, overallConfidence: overall([reach, impact, confidence, effort, aiComplexity]) },
    mode,
    generatedAt: Date.now(),
  };
}

/* -------------------------------- Demo path -------------------------------- */

function buildDemo(uc: UseCase, related: string[]): IdeaRecord {
  const text = `${uc.title} ${uc.problem} ${uc.area}`.toLowerCase();
  const aiFit = inferAiFit(text);
  const risk = inferRisk(text, uc);
  const primary = uc.area && uc.area !== "Unassigned" ? uc.area : inferStage(text);

  const reach: RiceFactor = {
    score: 3,
    evidence: uc.businessStakeholder ? `Sponsored by ${uc.businessStakeholder}.` : "Reach not yet quantified in the submission.",
    assumption: "Assumes a handful of teams/users benefit; no enterprise scaling data provided.",
    confidence: "low",
    question: "How many people or teams per year would use this?",
  };
  const impact: RiceFactor = {
    score: 2,
    evidence: uc.problem ? "Problem statement implies a real pain point." : "Impact inferred from the title only.",
    assumption: "Assumes moderate impact on the target outcome.",
    confidence: "low",
    question: "What measurable outcome (e.g. calls deflected, hours saved) would this move?",
  };
  const confidence: RiceFactor = {
    score: 0.5,
    evidence: "Early submission with limited evidence.",
    assumption: "Assumes the described approach is viable.",
    confidence: "low",
    question: "Do we have a comparable example that succeeded?",
  };
  const effort: RiceFactor = {
    score: 3,
    evidence: uc.platform ? `Touches ${uc.platform}.` : "Systems involved not fully specified.",
    assumption: "Assumes a small delivery team over a quarter.",
    confidence: "low",
    question: "What integrations and data access are required?",
  };
  const aiComplexity: RiceFactor = {
    score: aiFit.complexity,
    evidence: `Pattern: ${aiFit.pattern}.`,
    assumption: "Assumes standard tooling for this pattern.",
    confidence: "medium",
    question: "How clean and accessible is the source data?",
  };
  const score = computeRice({ reach: reach.score, impact: impact.score, confidence: confidence.score, effort: effort.score, aiComplexity: aiComplexity.score });

  return {
    provisional: true,
    executiveSummary:
      `This is a provisional, AI-generated triage summary for "${uc.title}". ` +
      `${uc.problem ? uc.problem.trim().replace(/\s+/g, " ").slice(0, 200) + ". " : ""}` +
      `It appears to sit in the ${primary} area of the member value stream. ` +
      `The most likely approach is ${aiFit.pattern.toLowerCase()} (${aiFit.rationale}). ` +
      `Value depends on reach and adoption, which are not yet quantified. ` +
      `Risk is currently assessed as ${risk.level}. ` +
      `Treat the RICE-A score below as directional until the missing information is filled in.`,
    valueStream: { primary, secondary: inferStage(text) !== primary ? inferStage(text) : undefined },
    problemStatement: uc.problem || `Improve "${uc.title}" for members.`,
    desiredOutcome: "A measurable improvement to the target member journey with reduced effort/cost.",
    assumptions: {
      stated: [uc.problem ? "The described problem is real and worth solving." : "The title reflects a real need."].filter(Boolean),
      unstated: [
        "Sufficient, accessible, good-quality data exists.",
        "Users will adopt the new capability.",
        "No blocking privacy/compliance constraint.",
      ],
    },
    missingInfo: [
      "Annual volume / number of users or teams affected?",
      "What is the target metric and current baseline?",
      "What data is needed and do we have access/permission?",
      "Any regulatory, privacy, or security constraints?",
      "Is there an existing tool or team already doing this?",
    ],
    related: related,
    aiFit: { pattern: aiFit.pattern, rationale: aiFit.rationale },
    risk: risk,
    riceA: { reach, impact, confidence, effort, aiComplexity, score, overallConfidence: "low" },
    mode: "demo",
    generatedAt: Date.now(),
  };
}

function inferAiFit(text: string): { pattern: string; rationale: string; complexity: number } {
  if (/summar|extract|document|contract|rfp|read|parse|classif/.test(text))
    return { pattern: "Document intelligence / RAG", rationale: "reads and extracts from documents", complexity: 3 };
  if (/predict|forecast|risk score|propensity|churn|likelihood/.test(text))
    return { pattern: "Predictive ML", rationale: "predicts an outcome from data", complexity: 4 };
  if (/search|find|knowledge|faq|answer|assistant|copilot/.test(text))
    return { pattern: "Knowledge assistant / retrieval", rationale: "answers questions over a knowledge base", complexity: 3 };
  if (/automat|route|approve|workflow|handoff|process/.test(text))
    return { pattern: "Workflow redesign / automation", rationale: "streamlines a manual process", complexity: 2 };
  if (/report|dashboard|trend|analytics|metric/.test(text))
    return { pattern: "Analytics / BI", rationale: "surfaces insights from data", complexity: 2 };
  return { pattern: "AI (to be refined)", rationale: "approach not yet clear from the submission", complexity: 3 };
}

function inferRisk(text: string, uc: UseCase): IdeaRecord["risk"] {
  const sensitive = /phi|member|patient|claim|health|clinical|ssn|payment|eligibilit|hipaa|pii/.test(
    `${text} ${uc.dataSources || ""}`.toLowerCase()
  );
  if (sensitive)
    return { level: "moderate", requiredReviews: ["Privacy/HIPAA review", "Security review", "Responsible AI review"] };
  return { level: "low", requiredReviews: ["Data readiness check"] };
}

function inferStage(text: string): string {
  if (/enroll|eligib|onboard|id card|welcome/.test(text)) return "Enrollment & Onboarding";
  if (/claim|eob|denial|reimburs/.test(text)) return "Claims";
  if (/pharm|prescription|rx|formulary/.test(text)) return "Pharmacy";
  if (/auth|referral|care|utilization/.test(text)) return "Care & Utilization";
  if (/call|contact|service|chat|support|grievance|appeal/.test(text)) return "Member Services";
  if (/renew|retention|disenroll/.test(text)) return "Retention";
  return "Member Experience";
}

/* --------------------------------- utils ---------------------------------- */

function arr(x: unknown): string[] {
  return Array.isArray(x) ? x.map(String).filter(Boolean).slice(0, 12) : [];
}
function normConf(c: unknown): Confidence {
  return c === "high" || c === "medium" || c === "low" ? c : "low";
}
function overall(factors: RiceFactor[]): Confidence {
  const rank = { low: 0, medium: 1, high: 2 } as const;
  const avg = factors.reduce((s, f) => s + rank[f.confidence], 0) / factors.length;
  return avg >= 1.5 ? "high" : avg >= 0.75 ? "medium" : "low";
}
