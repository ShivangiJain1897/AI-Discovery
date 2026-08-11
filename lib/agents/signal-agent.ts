import { getProvider } from "../llm/provider";
import { MEMBER_VALUE_CHAIN } from "../domain/member-value-chain";
import type { AgentId, DiscoveryContext, Signal } from "./types";

/** Raw signal shape returned by the model (no id/agent yet). */
interface RawSignal {
  stageId: string;
  title: string;
  detail: string;
  severity: Signal["severity"];
  evidence: string[];
  confidence: number;
  impactedKpis: string[];
}

const VALID_STAGES = new Set(MEMBER_VALUE_CHAIN.stages.map((s) => s.id));

/**
 * Shared runner for the three signal-producing agents (defect, market, process).
 * Handles prompt assembly with the domain brief, JSON generation, validation,
 * and stamping each signal with a stable id + the owning agent.
 */
export async function runSignalAgent(params: {
  agent: AgentId;
  system: string;
  taskInstructions: string;
  mockKey: string;
  ctx: DiscoveryContext;
}): Promise<Signal[]> {
  const provider = await getProvider();
  const stageList = MEMBER_VALUE_CHAIN.stages
    .map((s) => `- ${s.id}: ${s.name} — ${s.summary}`)
    .join("\n");

  const briefBlock = params.ctx.domainBrief
    ? `Domain brief to ground your analysis:
Summary: ${params.ctx.domainBrief.summary}
Priority KPIs: ${params.ctx.domainBrief.priorityKpis.map((k) => k.kpi).join(", ")}
Focus stages: ${params.ctx.domainBrief.focusStages.join(", ")}
Constraints: ${params.ctx.domainBrief.constraints.join("; ")}
`
    : "";

  const prompt = `Focus: ${params.ctx.focus?.trim() || "General member experience improvement"}

${briefBlock}
Member value-chain stages (use these ids for stageId):
${stageList}

${params.taskInstructions}

Return a JSON object of this exact shape:
{
  "signals": [
    {
      "stageId": string,          // one of the stage ids above
      "title": string,            // short, specific
      "detail": string,           // 1-3 sentences
      "severity": "low"|"medium"|"high"|"critical",
      "evidence": string[],       // concrete sources or observations
      "confidence": number,       // 0..1
      "impactedKpis": string[]    // KPI display names or ids
    }
  ]
}
Return 4-6 signals, each anchored to a real stage. Be specific to payers/members.`;

  const raw = await provider.generateJson<{ signals: RawSignal[] }>({
    system: params.system,
    prompt,
    mockKey: params.mockKey,
    maxTokens: 2500,
  });

  const signals = Array.isArray(raw?.signals) ? raw.signals : [];
  return signals
    .filter((s) => s && typeof s.title === "string")
    .map((s, i) => normalize(s, params.agent, i));
}

function normalize(s: RawSignal, agent: AgentId, i: number): Signal {
  const stageId = VALID_STAGES.has(s.stageId) ? s.stageId : "member-services";
  const confidence = clamp01(typeof s.confidence === "number" ? s.confidence : 0.5);
  return {
    id: `${agent}-${i + 1}`,
    agent,
    stageId,
    title: String(s.title).slice(0, 160),
    detail: String(s.detail ?? ""),
    severity: (["low", "medium", "high", "critical"] as const).includes(s.severity)
      ? s.severity
      : "medium",
    evidence: Array.isArray(s.evidence) ? s.evidence.map(String).slice(0, 5) : [],
    confidence,
    impactedKpis: Array.isArray(s.impactedKpis) ? s.impactedKpis.map(String).slice(0, 4) : [],
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
