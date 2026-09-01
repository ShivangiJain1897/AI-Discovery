/**
 * Discovery Workflow — a guided, human-in-the-loop flow born from a chat.
 *
 * Input → (classify) → pick agents → per-agent INTAKE (auto-captured + still
 * needed) → run → sectioned FINDINGS → validate & augment → GENERATE (PRD /
 * backlog). Everything a user does is captured on the Workflow so the flow is
 * resumable and auditable.
 */

export type InputType = "auto" | "problem" | "idea" | "solution" | "requirement" | "transcript";

export type AgentId =
  | "user_research"
  | "process_mining"
  | "defect_detection"
  | "market"
  | "regulatory"
  | "business_priority";

export type Stage = "framing" | "intake" | "findings" | "generate";

/** One thing an agent needs to know before it can do good work. */
export interface IntakeField {
  id: string;
  question: string;
  /** Auto-captured from the input, or provided by the user. */
  value: string;
  /** True if the value was auto-extracted (vs. user-entered or empty). */
  captured: boolean;
  required: boolean;
}

export type Verdict = "correct" | "incorrect" | null;

export interface Finding {
  id: string;
  title: string;
  detail: string;
  verdict: Verdict;
}

export interface AgentState {
  agentId: AgentId;
  selected: boolean;
  intake: IntakeField[];
  status: "pending" | "intake" | "running" | "complete" | "error";
  summary?: string;
  findings: Finding[];
  /** Free-text "also consider…" the user adds to this section. */
  userNotes?: string;
  error?: string;
}

/** PRD flavor: a single feature vs. a whole product. */
export type PrdVariant = "feature" | "product";

export interface GeneratedOutput {
  id: string;
  kind: "prd" | "backlog";
  /** For PRDs: feature-level or full-product. */
  variant?: PrdVariant;
  title: string;
  /** Sectioned document (PRD) or list (backlog) rendered as sections. */
  sections: { heading: string; body?: string; bullets?: string[] }[];
  createdAt: number;
}

export interface Workflow {
  id: string;
  input: string;
  inputType: InputType;
  detectedType?: InputType;
  /**
   * Foundation shown for EVERY discovery, before the agents: industry,
   * business process, objective, and where it's coming from. Auto-captured
   * from the input; the user completes the gaps.
   */
  context: IntakeField[];
  stage: Stage;
  agents: AgentState[];
  outputs: GeneratedOutput[];
  mode: "live" | "demo";
  createdAt: number;
  updatedAt: number;
}
