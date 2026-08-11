/**
 * Shared types for the discovery agent system.
 *
 * Every agent consumes a DiscoveryContext and emits Signals. The orchestrator
 * collects signals from all agents and synthesizes them into ranked
 * Opportunities. Signals and Opportunities are always anchored to a
 * value-chain stage, which is what makes the output coherent and actionable.
 */

export type AgentId = "domain" | "defect" | "market" | "process";

export type Severity = "low" | "medium" | "high" | "critical";

export interface DiscoveryContext {
  valueChainId: "member";
  /** Optional free-text focus, e.g. "Medicare Advantage onboarding". */
  focus?: string;
  /** Domain brief produced by the Domain Agent; available to other agents. */
  domainBrief?: DomainBrief;
}

/** A single observation an agent surfaces, anchored to a value-chain stage. */
export interface Signal {
  id: string;
  agent: AgentId;
  stageId: string;
  title: string;
  detail: string;
  severity: Severity;
  /** Human-readable evidence / source for the observation. */
  evidence: string[];
  /** Optional numeric confidence 0..1. */
  confidence: number;
  /** KPI ids this signal most affects. */
  impactedKpis: string[];
}

/** Output of the Domain Context Agent. */
export interface DomainBrief {
  summary: string;
  /** Key member personas the agents should keep in mind. */
  personas: { name: string; motivation: string }[];
  /** The KPIs that matter most for this focus. */
  priorityKpis: { kpi: string; why: string }[];
  /** Regulatory / compliance constraints to respect. */
  constraints: string[];
  /** Stages the domain agent believes are highest-leverage right now. */
  focusStages: string[];
}

/** A synthesized, prioritized opportunity produced by the orchestrator. */
export interface Opportunity {
  id: string;
  title: string;
  stageId: string;
  problem: string;
  recommendation: string;
  /** Which agents' signals contributed to this opportunity. */
  contributingAgents: AgentId[];
  supportingSignalIds: string[];
  impact: 1 | 2 | 3 | 4 | 5;
  effort: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  impactedKpis: string[];
  /** impact / effort weighted, precomputed for sorting. */
  priorityScore: number;
}

export type DiscoveryStatus = "queued" | "running" | "complete" | "error";

export interface AgentRunResult {
  agent: AgentId;
  status: "complete" | "error";
  signals: Signal[];
  /** For the domain agent only. */
  brief?: DomainBrief;
  error?: string;
  startedAt: number;
  finishedAt: number;
}

export interface DiscoveryRun {
  id: string;
  valueChainId: "member";
  focus?: string;
  status: DiscoveryStatus;
  mode: "live" | "demo";
  createdAt: number;
  finishedAt?: number;
  agentRuns: AgentRunResult[];
  brief?: DomainBrief;
  signals: Signal[];
  opportunities: Opportunity[];
}
