/**
 * Intake tracker.
 *
 * Once a use case is worth pursuing (often promoted from a Discovery session),
 * it enters intake: a lightweight, team-facing tracker. This is where a use case
 * gets its stakeholders, data, platform, and status — and where the system helps
 * the team avoid duplication by surfacing similar existing use cases.
 */

export type IntakeStatus =
  | "new"
  | "in_discovery"
  | "in_review"
  | "approved"
  | "in_progress"
  | "on_hold"
  | "done"
  | "declined";

export const INTAKE_STATUSES: { id: IntakeStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "in_discovery", label: "In Discovery" },
  { id: "in_review", label: "In Review" },
  { id: "approved", label: "Approved" },
  { id: "in_progress", label: "In Progress" },
  { id: "on_hold", label: "On Hold" },
  { id: "done", label: "Done" },
  { id: "declined", label: "Declined" },
];

/** A note/update added by a team member — the collaboration trail. */
export interface Contribution {
  author: string;
  note: string;
  at: number;
}

export interface UseCase {
  id: string;
  title: string;
  /** Problem statement / description. */
  problem: string;
  /** Where it's coming from, e.g. "Member Services", "Enrollment". */
  area: string;
  status: IntakeStatus;
  submittedBy: string;

  // Stakeholders
  businessStakeholder?: string;
  techStakeholder?: string;
  dataStakeholder?: string;

  // Context
  dataSources?: string;
  platform?: string;
  tbd?: string;
  tags?: string[];

  /** Link back to the Discovery session this came from, if any. */
  linkedSessionId?: string;
  /** Discovery sessions run FROM this use case (the intake → discovery loop). */
  discoverySessionIds?: string[];

  contributions: Contribution[];

  /** AI triage analysis (provisional). Regenerated as the use case evolves. */
  analysis?: IdeaRecord;
  /** Human override of the AI score (guardrail: humans decide). */
  humanScore?: { score: number; by: string; rationale: string; at: number };
  /** Human triage/solution decision. */
  decision?: { decision: string; by: string; rationale: string; at: number };
  /** Versioned score trail — AI scores and human revisions over time. */
  scoreHistory?: ScoreEntry[];

  createdAt: number;
  updatedAt: number;
}

export interface ScoreEntry {
  at: number;
  stage: string;
  score: number;
  source: "ai" | "human";
  by: string;
  note?: string;
}

/* --------------------------- AI triage analysis --------------------------- */

export type Confidence = "low" | "medium" | "high";

/** One RICE-A factor, with the evidence/assumption/confidence/question the
 * spec requires so a number is never mistaken for a validated business case. */
export interface RiceFactor {
  score: number;
  evidence: string;
  assumption: string;
  confidence: Confidence;
  question: string;
}

/** RICE-A = (Reach × Impact × Confidence) / (Effort × (AI Complexity / 2)). */
export interface RiceA {
  reach: RiceFactor;
  impact: RiceFactor;
  confidence: RiceFactor; // 0..1 (a probability)
  effort: RiceFactor; // person-months
  aiComplexity: RiceFactor; // 1..5
  score: number; // computed server-side
  overallConfidence: Confidence;
}

/** The standardized idea record the Intake Analyst produces. Provisional. */
export interface IdeaRecord {
  provisional: true;
  executiveSummary: string;
  valueStream: { primary: string; secondary?: string };
  problemStatement: string;
  desiredOutcome: string;
  assumptions: { stated: string[]; unstated: string[] };
  missingInfo: string[];
  related: string[];
  aiFit: { pattern: string; rationale: string };
  risk: { level: "low" | "moderate" | "high"; requiredReviews: string[] };
  riceA: RiceA;
  mode: "live" | "demo";
  generatedAt: number;
}

/** A similarity match returned when adding/checking a use case. */
export interface SimilarMatch {
  id: string;
  title: string;
  area: string;
  status: IntakeStatus;
  score: number; // 0..1
  sharedTerms: string[];
}

export interface CreateUseCaseInput {
  title: string;
  problem: string;
  area?: string;
  submittedBy?: string;
  businessStakeholder?: string;
  techStakeholder?: string;
  dataStakeholder?: string;
  dataSources?: string;
  platform?: string;
  tbd?: string;
  tags?: string[];
  linkedSessionId?: string;
}
