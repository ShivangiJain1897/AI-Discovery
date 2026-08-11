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
  /**
   * Optional member app to ground the Defect agent in real reviews. Accepts an
   * app name ("Aetna Health"), an App Store URL, or a numeric app id.
   */
  appTarget?: string;
  /** Domain brief produced by the Domain Agent; available to other agents. */
  domainBrief?: DomainBrief;
}

/** Describes what real source (if any) grounded an agent's output. */
export interface Grounding {
  /** "live-reviews" = real app-store data; "generated" = model/seed only. */
  kind: "live-reviews" | "generated";
  detail: string;
  /** For live-reviews: the resolved app and how many reviews were analyzed. */
  app?: { id: string; name: string; url?: string; reviewsAnalyzed: number };
}

/**
 * A real, clickable source backing a signal. This is what makes a signal
 * auditable: a skeptic can open the link and read the actual member review.
 */
export interface EvidenceSource {
  /** e.g. "App Store review · ★1 · v4.2.1". */
  label: string;
  /** Verbatim quote from the source (truncated). */
  quote?: string;
  /** Deep link to the original source, when available. */
  url?: string;
  /** Extra metadata: author, date, rating. */
  meta?: string;
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
  /**
   * Real, citable sources. When present, the signal is GROUNDED — it traces to
   * actual external data (e.g. app-store reviews) rather than model generation.
   */
  sources?: EvidenceSource[];
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
  /** How this agent's output was sourced (real data vs generated). */
  grounding?: Grounding;
  error?: string;
  startedAt: number;
  finishedAt: number;
}

export interface DiscoveryRun {
  id: string;
  valueChainId: "member";
  focus?: string;
  /** Member app targeted for review-grounded defect detection, if any. */
  appTarget?: string;
  status: DiscoveryStatus;
  mode: "live" | "demo";
  createdAt: number;
  finishedAt?: number;
  agentRuns: AgentRunResult[];
  brief?: DomainBrief;
  signals: Signal[];
  opportunities: Opportunity[];
}
