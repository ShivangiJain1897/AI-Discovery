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
  createdAt: number;
  updatedAt: number;
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
