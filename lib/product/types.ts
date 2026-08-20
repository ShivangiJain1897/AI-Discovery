/**
 * AI Product Studio — domain model.
 *
 * A PRODUCT is the workspace. Each product configures a team of AGENTS that
 * produce SIGNALS, which an AI synthesizer turns into a prioritized BACKLOG the
 * PM curates and owns. Everything is scoped to a product so a PM can run several
 * products independently.
 */

export interface ProductBrief {
  overview: string;
  targetUsers: string;
  valueProp: string;
  platform: string;
  /** Optional: where the code lives (for the maturity-path knowledge agent). */
  codebaseUrl?: string;
  market: string;
  regulatoryContext: string;
  kpis: string[];
}

export interface AgentRunLite {
  agentId: string;
  status: "complete" | "error";
  signalCount: number;
  at: number;
  error?: string;
}

export interface Product {
  id: string;
  name: string;
  oneLiner: string;
  brief: ProductBrief;
  /** Agent ids enabled for this product. */
  enabledAgents: string[];
  /** Latest signals produced by the enabled agents (replaced on each run). */
  signals: Signal[];
  /** Summary of the last run per agent. */
  lastRun?: AgentRunLite[];
  createdAt: number;
  updatedAt: number;
}

export type Severity = "low" | "medium" | "high" | "critical";

/** A finding an agent surfaces for a product; the raw material for the backlog. */
export interface Signal {
  id: string;
  productId: string;
  agentId: string;
  title: string;
  detail: string;
  severity: Severity;
  /** Short evidence / source line. */
  evidence?: string;
  createdAt: number;
}

export type BacklogBucket = "now" | "next" | "later" | "icebox";
export type BacklogStatus = "proposed" | "accepted" | "in_progress" | "done" | "dismissed";
export type BacklogSource = "agent" | "manual" | "chat";

export interface BacklogItem {
  id: string;
  productId: string;
  title: string;
  description: string;
  source: BacklogSource;
  /** For agent-sourced items: which agent, and the signal it came from. */
  agentId?: string;
  signalId?: string;
  impact: 1 | 2 | 3 | 4 | 5;
  effort: 1 | 2 | 3 | 4 | 5;
  confidence: number; // 0..1
  priorityScore: number; // computed
  bucket: BacklogBucket;
  status: BacklogStatus;
  /** Manual sort rank within a bucket (lower = higher). */
  rank: number;
  /** True once a human edits score/bucket (so re-generation won't clobber it). */
  humanAdjusted?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProductInput {
  name?: string;
  oneLiner: string;
  brief?: Partial<ProductBrief>;
  enabledAgents?: string[];
}
