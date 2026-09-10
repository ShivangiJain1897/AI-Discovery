/**
 * ANALYSIS FRAMEWORKS — Stage 2 of the pipeline.
 *
 * Research (Stage 1) gathers evidence via research agents. Analysis (Stage 2)
 * turns that evidence into decisions using a chosen FRAMEWORK. The user picks
 * one or more frameworks (multiselect); each produces its own structured
 * deliverable. Generate (Stage 3) turns the analysis into a PRD / backlog.
 *
 * Drawn from the Product Analysis Intelligence skill. To add a framework, add
 * an entry here — the API and UI pick it up automatically.
 */
export interface AnalysisFramework {
  id: string;
  name: string;
  /** Short, business-readable description of what it answers. */
  blurb: string;
  /** The methodology label shown on the output. */
  method: string;
  /** Framework-specific instruction appended to the analysis prompt (live mode). */
  ask: string;
}

export const ANALYSIS_FRAMEWORKS: AnalysisFramework[] = [
  {
    id: "executive",
    name: "Executive Synthesis",
    blurb: "The cross-lens story: themes, what matters, and the headline takeaway.",
    method: "Cross-lens synthesis",
    ask: 'Sections: "Executive Synthesis" (3-5 cross-cutting themes + the single headline takeaway); "Evidence Map" as a table ["Insight","From","Evidence strength","Why it matters"]; "What Stands Out"; "Recommended Next Steps".',
  },
  {
    id: "problem",
    name: "Problem Analysis",
    blurb: "Separate symptoms from the root problem and its consequences.",
    method: "Symptom → Root cause → Consequence",
    ask: 'Sections: "Problem Statement"; "Symptoms vs Root Problem" as a table ["Symptom","Likely root problem","Consequence","Evidence"]; "Who is affected"; "So what for the product".',
  },
  {
    id: "root_cause",
    name: "Root Cause Analysis",
    blurb: "Why is this happening? Ranked hypotheses with supporting/contradicting evidence.",
    method: "Hypothesis grid",
    ask: 'Sections: "Root Cause Hypotheses" as a table ["Hypothesis","Supporting evidence","Contradicting evidence","Confidence","How to validate"]; "Most likely cause(s)"; "What to validate first". Never claim causation from correlation.',
  },
  {
    id: "opportunity",
    name: "Opportunity Analysis",
    blurb: "Where product investment could create value, scored on value and evidence.",
    method: "How-Might-We + opportunity scoring",
    ask: 'Sections: "Opportunity Portfolio" as a table ["Opportunity (HMW…)","User value","Business value","Evidence","Confidence"]; "Top opportunities"; "Quick wins vs bets".',
  },
  {
    id: "use_case",
    name: "Use Case Analysis",
    blurb: "Turn an idea into concrete use cases — actors, triggers, scenarios, and the one to pursue first.",
    method: "Use-case decomposition",
    ask: 'The input is an idea/solution; enumerate and detail the USE CASES it enables. Sections: "Use Case Landscape" as a table ["Use case","Actor / persona","Trigger / context","Goal / outcome","Value (H/M/L)"] — list the distinct use cases the idea supports; "Primary Use Case" — the highest-value one, detailed with preconditions, a numbered main flow, alternate/exception flows, and success criteria; "Prioritized Use Cases" — ranked with rationale (value × feasibility × evidence); "What to validate first". Ground use cases in the research; mark speculative ones as hypotheses and never invent adoption or usage numbers.',
  },
  {
    id: "prioritization",
    name: "Prioritization",
    blurb: "What to do first — scored and bucketed Now / Next / Later.",
    method: "RICE / Impact-Effort",
    ask: 'Sections: "Prioritization" as a table ["Item","Impact","Effort","Confidence","Priority (Now/Next/Later)"] ordered by priority; "Now / Next / Later" bullets; "What NOT to do yet". Show the scoring reasoning; never hide weak assumptions behind a number.',
  },
  {
    id: "business_value",
    name: "Business Value",
    blurb: "Is it worth doing? Value drivers with a transparent low/base/high model.",
    method: "Value-driver tree + scenarios",
    ask: 'Sections: "Value Hypothesis"; "Value Drivers" as a table ["Driver","How value is created","Baseline needed","Assumption"]; "Low / Base / High" scenarios; "Key assumptions". Never invent financial precision; show every assumption.',
  },
  {
    id: "options",
    name: "Options & Trade-offs",
    blurb: "Compare the real alternatives, including 'do nothing'.",
    method: "Decision matrix",
    ask: 'Sections: "Options" as a table ["Option","User value","Business value","Effort","Risk","Key trade-off"] (include a "do nothing / maintain" row); "Recommended option and why"; "Why not the others".',
  },
  {
    id: "swot",
    name: "SWOT & Strategy",
    blurb: "Strengths, weaknesses, opportunities, threats → strategic choices.",
    method: "SWOT / TOWS",
    ask: 'Sections: "SWOT" as a table ["Type (S/W/O/T)","Statement","Evidence","Strategic relevance"]; "Strategic Implications"; "Recommended strategic priorities". Strength/Weakness = internal; Opportunity/Threat = external.',
  },
  {
    id: "journey",
    name: "Journey & Friction",
    blurb: "Map the current experience and locate the moments of friction.",
    method: "Journey mapping",
    ask: 'Sections: "Current-State Journey" as a table ["Stage","User goal","Action / touchpoint","Friction / pain","Opportunity"]; "Moments that matter"; "Highest-friction stages". Mark inferred steps as assumptions.',
  },
  {
    id: "risk",
    name: "Risk & Feasibility",
    blurb: "What could stop this working, and how feasible it is.",
    method: "Likelihood × Impact",
    ask: 'Sections: "Risks" as a table ["Risk","Type","Likelihood","Impact","Mitigation"]; "Key dependencies"; "Feasibility read (data / tech / operational / regulatory)".',
  },
];

export function getFramework(id: string): AnalysisFramework | undefined {
  return ANALYSIS_FRAMEWORKS.find((f) => f.id === id);
}
