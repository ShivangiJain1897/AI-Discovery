/**
 * LLM-based grounding for the Defect agent.
 *
 * Given real reviews, Claude clusters them into stage-anchored defect signals
 * and, crucially, tells us WHICH reviews support each signal (by index). We then
 * attach the real source metadata ourselves — so the model chooses the evidence
 * but cannot fabricate a citation. This keeps every signal auditable.
 */
import { getProvider } from "../llm/provider";
import { MEMBER_VALUE_CHAIN } from "../domain/member-value-chain";
import type { DiscoveryContext, EvidenceSource, Severity, Signal } from "./types";
import type { Review } from "../sources/app-reviews";

interface RawGroundedSignal {
  stageId: string;
  title: string;
  detail: string;
  severity: Severity;
  impactedKpis: string[];
  sourceIndexes: number[];
}

const VALID_STAGES = new Set(MEMBER_VALUE_CHAIN.stages.map((s) => s.id));

const SYSTEM = `You are the Defect Detection Agent for a health-plan member experience.
You are given REAL, recent customer reviews of a member-facing mobile app.
Cluster the negative reviews into distinct production defects / UX failures, each anchored to a stage of the member value chain.
Only report problems that are actually supported by the provided reviews. Never invent issues that the reviews do not evidence.
For each defect, cite the exact reviews (by their index) that support it.`;

export async function runGroundedDefectAgent(
  ctx: DiscoveryContext,
  reviews: Review[],
  appName: string
): Promise<Signal[]> {
  const provider = await getProvider();
  const stageList = MEMBER_VALUE_CHAIN.stages.map((s) => `- ${s.id}: ${s.name}`).join("\n");

  // Focus the model on negatives; cap payload for token safety.
  const negatives = reviews.filter((r) => r.rating <= 3).slice(0, 60);
  const digest = negatives
    .map((r, i) => `[${i}] ★${r.rating} "${oneLine(r.title)}" — ${oneLine(r.content).slice(0, 300)}`)
    .join("\n");

  const prompt = `App under analysis: ${appName}
Focus: ${ctx.focus?.trim() || "General member experience"}

Member value-chain stages (use these ids for stageId):
${stageList}

Real negative reviews (index in brackets):
${digest}

Return a JSON object of this exact shape:
{
  "signals": [
    {
      "stageId": string,            // one of the stage ids above
      "title": string,              // short, specific defect name
      "detail": string,             // 1-3 sentences describing the defect and member impact
      "severity": "low"|"medium"|"high"|"critical",
      "impactedKpis": string[],     // KPI names most affected
      "sourceIndexes": number[]     // indexes of the reviews that support this (2-5)
    }
  ]
}
Return 3-6 defects, each supported by at least one real review index. Do not include problems the reviews don't show.`;

  const raw = await provider.generateJson<{ signals: RawGroundedSignal[] }>({
    system: SYSTEM,
    prompt,
    // No mockKey: grounded path only runs in live mode. If somehow called in
    // demo mode, the provider will throw and the caller falls back to clustering.
    maxTokens: 2500,
  });

  const signals = Array.isArray(raw?.signals) ? raw.signals : [];
  return signals
    .filter((s) => s && typeof s.title === "string")
    .map((s, i) => normalize(s, negatives, i))
    .filter((s): s is Signal => s !== null);
}

function normalize(s: RawGroundedSignal, negatives: Review[], i: number): Signal | null {
  const idxs = Array.isArray(s.sourceIndexes) ? s.sourceIndexes : [];
  const cited = idxs
    .map((n) => negatives[n])
    .filter((r): r is Review => Boolean(r));
  // Require at least one real citation — otherwise it isn't grounded.
  if (cited.length === 0) return null;

  const sources: EvidenceSource[] = cited.slice(0, 5).map((r) => ({
    label: `App Store review · ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}${
      r.version ? ` · v${r.version}` : ""
    }`,
    quote: oneLine(r.content || r.title).slice(0, 240),
    url: r.url,
    meta: `${r.author}${r.updated ? ` · ${r.updated.slice(0, 10)}` : ""}`,
  }));

  return {
    id: `defect-${i + 1}`,
    agent: "defect",
    stageId: VALID_STAGES.has(s.stageId) ? s.stageId : "member-services",
    title: String(s.title).slice(0, 160),
    detail: String(s.detail ?? ""),
    severity: (["low", "medium", "high", "critical"] as const).includes(s.severity)
      ? s.severity
      : "medium",
    evidence: cited.slice(0, 4).map((r) => `★${r.rating} "${oneLine(r.title || r.content).slice(0, 80)}"`),
    sources,
    confidence: clamp01(0.55 + Math.min(cited.length, 6) * 0.06),
    impactedKpis: Array.isArray(s.impactedKpis) ? s.impactedKpis.map(String).slice(0, 4) : [],
  };
}

function oneLine(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}
