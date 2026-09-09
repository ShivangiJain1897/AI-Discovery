/**
 * AI Discovery — the whole model.
 *
 *   an idea  →  research  →  findings  →  a document you asked for
 *
 * That's it. One Discovery object holds the idea, what the research found, and
 * every document generated from it. Documents are generated from the findings
 * already gathered, so asking for a second one never re-runs research.
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
  createdAt: number;
}

export interface Discovery {
  id: string;
  idea: string;
  kind: Kind;
  context: Context;
  lenses: LensResult[];
  summary?: Summary;
  documents: GeneratedDoc[];
  /** Extra context added after the fact; feeds every document generated later. */
  notes: string[];
  mode: "live" | "demo";
  createdAt: number;
  updatedAt: number;
}
