/**
 * Depth and audience (spec Step 9).
 *
 * The same evidence produces very different documents depending on how much
 * time the PM has and who is going to read it. These directives are injected
 * into every generation prompt.
 */
import type { AudienceId, DepthMode } from "../types";

export interface DepthDef {
  id: DepthMode;
  name: string;
  blurb: string;
  /** Injected into generation prompts. */
  directive: string;
  /** Token budget for a generated document at this depth. */
  budget: number;
  /** How many findings each research specialist should return. */
  findings: [number, number];
}

export const DEPTH_MODES: DepthDef[] = [
  {
    id: "quick",
    name: "Quick",
    blurb: "5–10 minute decision support.",
    directive:
      "DEPTH: QUICK. The reader has ten minutes. Give the conclusion and the two or three things that drive it. No methodology narration, no background section, no exhaustive tables. If a section would not change what they do next, cut it entirely.",
    budget: 1800,
    findings: [2, 3],
  },
  {
    id: "standard",
    name: "Standard",
    blurb: "Normal PM working analysis.",
    directive:
      "DEPTH: STANDARD. A working analysis for a product manager: enough reasoning to be checkable, enough structure to be usable, no padding. Name the method where it matters.",
    budget: 3200,
    findings: [3, 5],
  },
  {
    id: "deep",
    name: "Deep",
    blurb: "Comprehensive research and analytical assessment.",
    directive:
      "DEPTH: DEEP. A comprehensive assessment. Show the reasoning chain, the alternatives considered and rejected, the sensitivity of the conclusions, and where the evidence is thin. Depth means more RIGOUR, not more words — every added paragraph must add an argument, not restate one.",
    budget: 6000,
    findings: [5, 8],
  },
  {
    id: "executive",
    name: "Executive",
    blurb: "Decision-oriented, minimal methodology.",
    directive:
      "DEPTH: EXECUTIVE. Answer first, in the opening paragraph. Minimal methodology — the reader trusts the process and wants the call. Every claim carries an explicit confidence. Anything that reads as build-up must be deleted.",
    budget: 1600,
    findings: [2, 4],
  },
  {
    id: "working",
    name: "Working session",
    blurb: "Detailed material for the team to work from.",
    directive:
      "DEPTH: WORKING SESSION. This is material a product team will sit around and argue with. Show the workings: the tables, the open questions, the disagreements in the evidence, the things still to decide. Leave the seams visible — flag every point where the team needs to make a call.",
    budget: 5000,
    findings: [4, 7],
  },
];

export interface AudienceDef {
  id: AudienceId;
  name: string;
  directive: string;
}

export const AUDIENCES: AudienceDef[] = [
  { id: "product_team", name: "Product team", directive: "AUDIENCE: the product team. Assume product literacy. Be concrete about scope, trade-offs and what is still undecided." },
  { id: "engineering", name: "Engineering", directive: "AUDIENCE: engineers. Be precise about behaviour, edge cases, data and constraints. Do not hand-wave requirements. Skip market narrative." },
  { id: "design", name: "Design", directive: "AUDIENCE: designers. Lead with the user, the job, the moments and the friction. Be specific about context of use; avoid prescribing UI." },
  { id: "leadership", name: "Leadership", directive: "AUDIENCE: senior leadership. Lead with the recommendation and the business consequence. Name the trade-off being accepted. Keep methodology to a line." },
  { id: "customer", name: "Customer", directive: "AUDIENCE: a customer. Plain language, no internal jargon, no internal metrics, and absolutely no unverified claims." },
  { id: "sales", name: "Sales", directive: "AUDIENCE: sales. Give them what to say, the proof behind it, and what they must not claim. Objections handled explicitly." },
  { id: "operations", name: "Operations", directive: "AUDIENCE: operations. Focus on process, actors, handoffs, exceptions and what changes in the day-to-day. Be concrete about who does what." },
  { id: "compliance", name: "Compliance", directive: "AUDIENCE: compliance / legal. Name the specific obligation, the control, the evidence and what needs sign-off. Claim no legal conclusions." },
  { id: "executive", name: "Executive committee", directive: "AUDIENCE: the executive committee. One page of consequence: the decision, the money, the risk, the ask. No methodology." },
];

export function getDepth(id: DepthMode): DepthDef {
  return DEPTH_MODES.find((d) => d.id === id) ?? DEPTH_MODES[1];
}
export function getAudience(id: AudienceId): AudienceDef {
  return AUDIENCES.find((a) => a.id === id) ?? AUDIENCES[0];
}
