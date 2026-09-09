/** Client-side mirrors of the orchestrator's session shape. */
export type EvidenceStrength = "Strong" | "Moderate" | "Directional" | "Hypothesis";
export type EvidenceType = "fact" | "inference" | "assumption" | "gap" | "contradiction";
export type Confidence = "High" | "Medium" | "Low";

export interface PlanItem { id: string; required: boolean; why: string; selected: boolean }
export interface Clarification { id: string; question: string; why: string; answer: string }
export interface Plan {
  objective: string; decision: string; stakeholders: string; scope: string;
  existingEvidence: string; consumer: string; assumptions: string[];
  depth: string; audience: string;
  research: PlanItem[]; analysis: PlanItem[]; outputs: PlanItem[];
  clarifications: Clarification[];
}
export interface EvidenceItem { id: string; statement: string; type: EvidenceType; strength: EvidenceStrength; source?: string }
export interface StreamFinding { id: string; title: string; detail: string; strength: EvidenceStrength }
export interface ResearchStream {
  capabilityId: string; selected: boolean;
  status: "pending" | "running" | "complete" | "error";
  summary?: string; evidence: EvidenceItem[]; findings: StreamFinding[];
  patterns: string[]; contradictions: string[]; gaps: string[]; implications: string[];
  sources: string[]; userNotes?: string; error?: string; ranAt?: number;
}
export interface Synthesis {
  createdAt: number; headline: string;
  themes: { title: string; body: string; supportedBy: string[]; strength: EvidenceStrength }[];
  triangulation: { insight: string; sources: string[]; agreement: string; strength: EvidenceStrength }[];
  insights: { id: string; insight: string; soWhat: string; implication: string; confidence: Confidence; supportedBy: string[] }[];
  opportunities: { id: string; title: string; hmw: string; userValue: string; businessValue: string; evidence: EvidenceStrength }[];
  contradictions: string[]; gaps: string[];
}
export interface DocSection {
  heading: string; method?: string; body?: string; bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
}
export interface AnalysisRun {
  id: string; methodId: string; name: string; method: string; family: string;
  sections: DocSection[]; createdAt: number;
}
export interface DecisionBrief {
  createdAt: number; evidence: string[]; insight: string;
  options: { name: string; description: string; benefits: string; costs: string; risks: string; effort: string }[];
  recommendation: string; rationale: string; confidence: Confidence;
  gaps: string[]; nextSteps: string[];
}
export interface Artifact {
  id: string; outputId: string; family: string; title: string;
  depth: string; audience: string; sections: DocSection[]; createdAt: number;
}
export interface Session {
  id: string; input: string; inputType: string; detectedType: string;
  plan: Plan; stage: string; streams: ResearchStream[]; synthesis?: Synthesis;
  analyses: AnalysisRun[]; decision?: DecisionBrief; artifacts: Artifact[];
  notes: string[]; mode: "live" | "demo"; createdAt: number; updatedAt: number;
}

export interface Catalog {
  research: { id: string; letter: string; name: string; icon: string; blurb: string; investigates: string[]; sources: string[]; live: boolean }[];
  methodFamilies: { id: string; name: string; blurb: string }[];
  methods: { id: string; name: string; familyId: string; blurb: string; method: string; evidenceNeeded: string }[];
  outputFamilies: { id: string; name: string; blurb: string; icon: string }[];
  outputs: { id: string; name: string; familyId: string; blurb: string; needs: string }[];
  depths: { id: string; name: string; blurb: string }[];
  audiences: { id: string; name: string }[];
  mode: "live" | "demo";
}
