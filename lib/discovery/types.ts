/**
 * AI Discovery — the whole model.
 *
 *   an idea  →  research  →  findings  →  a document you asked for
 *                    ↑                            ↓
 *                    └────────  keep talking  ────┘
 *
 * One Discovery object holds the idea, what the research found, every document
 * generated from it, and the conversation that follows. Documents are written
 * from findings already gathered, so asking for a second one never re-runs
 * research — but you can ask for more research when you want it.
 */

/** Are we discovering a whole product, or one feature of an existing one? */
export type Kind = "product" | "feature";

/** How much to trust a finding. Three levels, because five is a taxonomy. */
export type Confidence = "High" | "Medium" | "Low";

export type LensId =
  | "user_research"
  | "market"
  | "bugs"
  | "process"
  | "compliance"
  | "feasibility";

export interface Finding {
  id: string;
  title: string;
  detail: string;
  confidence: Confidence;
  /** Where this came from — a source, or what would be needed to confirm it. */
  basis: string;
}

export interface LensResult {
  lensId: LensId;
  status: "pending" | "running" | "done" | "error";
  summary: string;
  findings: Finding[];
  /** What this lens could not establish, and how to find out. */
  gaps: string[];
  sources: string[];
  error?: string;
}

/** What the research adds up to. Written automatically, read in 30 seconds. */
export interface Summary {
  headline: string;
  learned: string[];
  opportunities: string[];
  risks: string[];
}

/** What we understood about the idea before researching it. */
export interface Context {
  industry: string;
  users: string;
  problem: string;
  goal: string;
}

export interface DocSection {
  heading: string;
  body?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
}

export type DocumentId = "use_cases" | "prd" | "backlog" | "business_case";

export interface GeneratedDoc {
  id: string;
  documentId: DocumentId;
  title: string;
  sections: DocSection[];
  /** What the PM asked for, when this is a refinement of an earlier version. */
  instruction?: string;
  /** Which version of this document type it is, from 1. */
  version: number;
  createdAt: number;
}

/**
 * What the assistant did in reply — so the thread can show the result inline
 * rather than making the PM hunt for what changed.
 */
export interface TurnAction {
  kind: "answer" | "research" | "document" | "refine" | "context";
  /** Short human summary, e.g. "Ran feasibility research". */
  label: string;
  /** Lenses run, for kind "research". */
  lensIds?: LensId[];
  /** The document produced, for kind "document" and "refine". */
  docId?: string;
}

/** One message in the conversation. */
export interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: TurnAction;
  createdAt: number;
}

export interface Discovery {
  id: string;
  idea: string;
  kind: Kind;
  context: Context;
  lenses: LensResult[];
  summary?: Summary;
  /** Every document made, newest last. Refining appends a version. */
  documents: GeneratedDoc[];
  /** The conversation. Keeps going after the first results land. */
  turns: Turn[];
  /** Extra context the PM supplied; feeds every document generated later. */
  notes: string[];
  mode: "live" | "demo";
  createdAt: number;
  updatedAt: number;
}
