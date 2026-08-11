/**
 * Capability system.
 *
 * The product is now: paste ANY input (a feature idea, a written requirement, or
 * a meeting transcript), pick one or more CAPABILITIES, and get structured
 * outputs. Each capability is a self-contained unit of work — generate a PRD,
 * research the market, foresee defects, quantify business value, and so on.
 *
 * Every capability produces the same shape (title + summary + sections), so a
 * single renderer displays all of them and adding a capability is one entry.
 */

export type CapabilityCategory = "Document" | "Research" | "Analysis" | "Value";

export type InputType = "auto" | "feature" | "requirement" | "transcript";

export interface AnalyzeInput {
  /** The pasted text: a feature idea, requirement, or transcript. */
  text: string;
  inputType: InputType;
  /** Optional product/app context, e.g. "Payer member portal (Medicare Advantage)". */
  productContext?: string;
}

export interface CapabilityMeta {
  id: string;
  name: string;
  /** One-line description shown on the picker card. */
  blurb: string;
  category: CapabilityCategory;
  icon: string;
  /** What this capability becomes at maturity (the "advanced" story). */
  future?: string;
}

/** A table rendered inside an output section (e.g. quantified value metrics). */
export interface OutputTable {
  columns: string[];
  rows: string[][];
}

export interface OutputSection {
  heading: string;
  body?: string;
  bullets?: string[];
  table?: OutputTable;
}

/** Uniform structured output produced by every capability. */
export interface CapabilityOutput {
  capabilityId: string;
  title: string;
  summary: string;
  sections: OutputSection[];
  tags?: string[];
  /** Optional callout, e.g. the "connect to production to ground this" note. */
  note?: string;
}

export type SessionStatus = "queued" | "running" | "complete" | "error";

export interface CapabilityRun {
  capabilityId: string;
  status: "complete" | "error";
  output?: CapabilityOutput;
  error?: string;
  startedAt: number;
  finishedAt: number;
}

export interface AnalyzeSession {
  id: string;
  input: AnalyzeInput;
  capabilityIds: string[];
  status: SessionStatus;
  mode: "live" | "demo";
  createdAt: number;
  finishedAt?: number;
  runs: CapabilityRun[];
}
