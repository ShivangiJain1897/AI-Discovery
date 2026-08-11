import { getProvider } from "../llm/provider";
import { getStage } from "../domain/member-value-chain";
import { runDomainAgent } from "./domain-agent";
import { runDefectAgent } from "./defect-agent";
import { runMarketAgent } from "./market-agent";
import { runProcessAgent } from "./process-agent";
import type {
  AgentId,
  AgentRunResult,
  DiscoveryContext,
  DiscoveryRun,
  Opportunity,
  Signal,
} from "./types";

const SEVERITY_WEIGHT: Record<Signal["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Runs a full discovery: domain grounding first, then the three signal agents in
 * parallel, then synthesis. Signals and per-agent results are attached as they
 * complete so the run object is a complete audit trail of what each agent found.
 */
export async function runDiscovery(
  run: DiscoveryRun,
  onProgress?: (run: DiscoveryRun) => void
): Promise<DiscoveryRun> {
  const provider = await getProvider();
  run.mode = provider.mode;
  run.status = "running";
  onProgress?.(run);

  const ctx: DiscoveryContext = { valueChainId: "member", focus: run.focus };

  // 1. Domain grounding (sequential — its brief feeds the others).
  const domainResult = await runAgent("domain", async () => {
    const brief = await runDomainAgent(ctx);
    return { signals: [] as Signal[], brief };
  });
  run.agentRuns.push(domainResult);
  if (domainResult.brief) {
    run.brief = domainResult.brief;
    ctx.domainBrief = domainResult.brief;
  }
  onProgress?.(run);

  // 2. Signal agents in parallel, each grounded by the domain brief.
  const [defect, market, process] = await Promise.all([
    runAgent("defect", async () => ({ signals: await runDefectAgent(ctx) })),
    runAgent("market", async () => ({ signals: await runMarketAgent(ctx) })),
    runAgent("process", async () => ({ signals: await runProcessAgent(ctx) })),
  ]);
  run.agentRuns.push(defect, market, process);
  run.signals = [...defect.signals, ...market.signals, ...process.signals];
  onProgress?.(run);

  // 3. Synthesize opportunities from the collected signals.
  run.opportunities = synthesize(run.signals);
  run.status = run.agentRuns.some((a) => a.status === "error") && run.signals.length === 0
    ? "error"
    : "complete";
  run.finishedAt = Date.now();
  onProgress?.(run);
  return run;
}

async function runAgent(
  agent: AgentId,
  fn: () => Promise<{ signals: Signal[]; brief?: AgentRunResult["brief"] }>
): Promise<AgentRunResult> {
  const startedAt = Date.now();
  try {
    const { signals, brief } = await fn();
    return { agent, status: "complete", signals, brief, startedAt, finishedAt: Date.now() };
  } catch (err) {
    return {
      agent,
      status: "error",
      signals: [],
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      finishedAt: Date.now(),
    };
  }
}

/**
 * Deterministic, explainable synthesizer.
 *
 * Clusters signals by value-chain stage and turns each cluster into a
 * prioritized opportunity. Cross-agent convergence (a stage flagged by defect
 * AND market AND process) is the strongest prioritization signal — those are
 * the moments where a real, market-relevant, operationally-rooted member problem
 * all line up. Impact rises with severity, convergence, and confidence; effort
 * is estimated from the mix of contributing agents.
 */
export function synthesize(signals: Signal[]): Opportunity[] {
  const byStage = new Map<string, Signal[]>();
  for (const s of signals) {
    const arr = byStage.get(s.stageId) ?? [];
    arr.push(s);
    byStage.set(s.stageId, arr);
  }

  const opportunities: Opportunity[] = [];
  for (const [stageId, group] of byStage) {
    const stage = getStage(stageId);
    const agents = unique(group.map((s) => s.agent));
    const maxSeverity = Math.max(...group.map((s) => SEVERITY_WEIGHT[s.severity]));
    const avgConfidence = group.reduce((a, s) => a + s.confidence, 0) / group.length;
    const convergence = agents.length; // 1..3

    // Impact 1..5: severity dominates, boosted by cross-agent convergence.
    const impactRaw = maxSeverity + (convergence - 1) * 1.0;
    const impact = clampScore(Math.round(impactRaw));

    // Effort 1..5: process-heavy problems cost more; pure defects are cheaper.
    const effort = estimateEffort(agents);

    const priorityScore = round2((impact / effort) * (0.6 + 0.4 * avgConfidence));

    const impactedKpis = unique(group.flatMap((s) => s.impactedKpis)).slice(0, 5);
    const lead = [...group].sort(
      (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.confidence - a.confidence
    )[0];

    opportunities.push({
      id: `opp-${stageId}`,
      title: opportunityTitle(stage?.name ?? stageId, agents, lead),
      stageId,
      problem: group.map((s) => `• ${s.title}: ${s.detail}`).join("\n"),
      recommendation: recommend(agents, stage?.name ?? stageId),
      contributingAgents: agents,
      supportingSignalIds: group.map((s) => s.id),
      impact,
      effort,
      confidence: round2(avgConfidence),
      impactedKpis,
      priorityScore,
    });
  }

  return opportunities.sort((a, b) => b.priorityScore - a.priorityScore);
}

function opportunityTitle(stageName: string, agents: AgentId[], lead: Signal): string {
  if (agents.length >= 3) return `${stageName}: convergent member pain across defects, market, and process`;
  if (agents.length === 2) return `${stageName}: ${lead.title}`;
  return `${stageName}: ${lead.title}`;
}

function recommend(agents: AgentId[], stageName: string): string {
  const parts: string[] = [];
  if (agents.includes("defect")) parts.push("fix the live defect(s) blocking members");
  if (agents.includes("process")) parts.push("re-engineer the underlying process/handoff (automation candidate)");
  if (agents.includes("market")) parts.push("close the competitive gap to reset member expectations");
  const joined =
    parts.length > 1 ? parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1] : parts[0];
  const convergence =
    agents.length >= 3
      ? " This stage is flagged by all three lenses — treat as a top-priority discovery to scope end-to-end."
      : agents.length === 2
        ? " Two independent lenses agree, raising confidence this is real."
        : "";
  return `In ${stageName}, ${joined}.${convergence}`;
}

function estimateEffort(agents: AgentId[]): Opportunity["effort"] {
  let e = 2;
  if (agents.includes("process")) e += 2; // process change is heavier
  if (agents.includes("market")) e += 1; // strategic/build work
  if (agents.length === 1 && agents[0] === "defect") e = 2; // a bug fix
  return clampScore(e);
}

function clampScore(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, n)) as 1 | 2 | 3 | 4 | 5;
}
function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
