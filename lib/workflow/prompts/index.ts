/**
 * Agent prompt registry.
 *
 * Each agent's editable definition lives in its own file in this folder:
 *   - `system`    — the persona + instructions Claude uses in LIVE mode
 *   - `questions` — the intake form the agent needs answered
 *   - `research`  — if true, the agent does live web research before answering
 *
 * To tune an agent, open its file (e.g. `user-research.ts`) and edit the
 * `system` string or its `questions`. Nothing else in the codebase needs to
 * change — `agents.ts` reads everything from here.
 */
import type { AgentId } from "../types";

export interface AgentPrompt {
  id: AgentId;
  name: string;
  icon: string;
  /** One-line description shown on the agent picker. */
  blurb: string;
  /** True → this agent runs live web research before producing findings. */
  research?: boolean;
  /** The persona + instructions used in live mode. Edit freely. */
  system: string;
  /** The intake questions this agent needs answered. */
  questions: { id: string; question: string; required: boolean }[];
}

import { userResearch } from "./user-research";
import { processMining } from "./process-mining";
import { defectDetection } from "./defect-detection";
import { market } from "./market";
import { regulatory } from "./regulatory";
import { businessPriority } from "./business-priority";

/** The full team, in display order. Add a new agent by adding a file + a line here. */
export const AGENT_PROMPTS: AgentPrompt[] = [
  userResearch,
  processMining,
  defectDetection,
  market,
  regulatory,
  businessPriority,
];
