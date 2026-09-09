/**
 * LAYER 4 — OUTPUT FAMILIES (spec Step 8).
 *
 * The artifact is not the analysis. Several artifacts can be generated from one
 * body of evidence, in any order, without re-running research — that rule is
 * enforced by `generate.ts`, which only ever reads the session's existing
 * evidence, synthesis, analyses and decision.
 *
 * Each output declares the sections it should produce. Where it doesn't, the
 * family default applies.
 */

export interface OutputFamily {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  defaultAsk: string;
}

export interface OutputDef {
  id: string;
  name: string;
  familyId: string;
  blurb: string;
  /** What must exist in the session for this artifact to be worth generating. */
  needs: "evidence" | "synthesis" | "decision";
  ask?: string;
}

export const OUTPUT_FAMILIES: OutputFamily[] = [
  {
    id: "research",
    name: "Research",
    icon: "🔬",
    blurb: "Plan, run and write up the research itself.",
    defaultAsk:
      'Produce a practical research document: what we are trying to learn, the method, who we need to talk to or what data we need, the questions/instrument, and how findings will be used. Every question must earn its place — cut anything that would not change a decision.',
  },
  {
    id: "discovery",
    name: "Discovery",
    icon: "🧭",
    blurb: "Frame the problem, the users and the opportunity.",
    defaultAsk:
      'Produce a discovery artifact grounded strictly in the evidence gathered: what the problem is, who has it, the evidence for it, and what it opens up. Mark anything inferred.',
  },
  {
    id: "strategy",
    name: "Product Strategy",
    icon: "🎯",
    blurb: "Where the product is going and why.",
    defaultAsk:
      'Produce a strategy artifact that makes a CHOICE, not a wish list: the bet, what it rests on, what we are explicitly not doing, and what would make us change course.',
  },
  {
    id: "market",
    name: "Market & Competition",
    icon: "⚔️",
    blurb: "The outside view, ready to circulate.",
    defaultAsk:
      'Produce a market/competitive artifact with sources attached to every claim. Anything unverified must be labelled as such rather than dropped or asserted.',
  },
  {
    id: "decision",
    name: "Decision",
    icon: "⚖️",
    blurb: "Make the call, with the reasoning visible.",
    defaultAsk:
      'Produce a decision artifact: evidence, insight, options (including do-nothing), trade-offs, a clear recommendation, a confidence level, and what would need to be validated. State the recommendation in the first paragraph.',
  },
  {
    id: "definition",
    name: "Product Definition",
    icon: "📄",
    blurb: "What gets built, precisely enough to build it.",
    defaultAsk:
      'Produce a definition artifact a team could build from: problem, users, scope in/out, requirements, edge cases, acceptance criteria, metrics, risks and open questions. Every requirement must trace to evidence or be flagged as an assumption.',
  },
  {
    id: "backlog",
    name: "Product Backlog",
    icon: "🗂️",
    blurb: "Themes, epics and stories teams can pick up.",
    defaultAsk:
      'Produce backlog items that are independently valuable and testable, each with acceptance criteria and the evidence it came from.',
  },
  {
    id: "prioritization",
    name: "Prioritization",
    icon: "📐",
    blurb: "The ranked list, with the scoring shown.",
    defaultAsk:
      'Produce a prioritised list with every scoring input visible and the reasoning behind each score stated. Include what is deliberately not being done.',
  },
  {
    id: "roadmap",
    name: "Roadmap",
    icon: "🗺️",
    blurb: "Sequence and horizons, tied to outcomes.",
    defaultAsk:
      'Produce a roadmap organised by OUTCOME, not by feature list. Each horizon states the outcome sought, what we will do, and what we will learn. Do not imply date precision the evidence cannot support.',
  },
  {
    id: "experiment",
    name: "Experimentation",
    icon: "🧪",
    blurb: "Test the risky assumption before building.",
    defaultAsk:
      'Produce an experiment artifact with a falsifiable hypothesis, the design, the decision rule stated in advance, and the threats to validity.',
  },
  {
    id: "metrics",
    name: "Metrics",
    icon: "📈",
    blurb: "What success means and how it is measured.",
    defaultAsk:
      'Produce a measurement artifact: the outcome metric, its supporting inputs, guardrails, current baseline (or the fact that there is none), targets, and exactly how each is instrumented.',
  },
  {
    id: "quality",
    name: "Quality",
    icon: "🛠️",
    blurb: "Assess and fix what is broken.",
    defaultAsk:
      'Produce a quality artifact: what is failing, how often, what it costs, the root cause, the corrective action and how we will know it worked.',
  },
  {
    id: "launch",
    name: "Launch",
    icon: "🚀",
    blurb: "Get it into the world and adopted.",
    defaultAsk:
      'Produce a launch artifact: audience, message, sequencing, readiness criteria, rollout stages with go/no-go gates, enablement, and how adoption will be measured.',
  },
  {
    id: "operating",
    name: "Operating Model",
    icon: "🔄",
    blurb: "How the work will actually run.",
    defaultAsk:
      'Produce an operating artifact: the steps, the actors, the decision rights, the handoffs and the cadence. Be specific about who decides what.',
  },
  {
    id: "exec",
    name: "Executive Communication",
    icon: "📣",
    blurb: "The version leadership will actually read.",
    defaultAsk:
      'Lead with the answer. Minimal methodology, no build-up. Every claim carries its confidence. Length is a feature — be short.',
  },
];

export const OUTPUTS: OutputDef[] = [
  /* research */
  { id: "research_plan", name: "Research Plan", familyId: "research", needs: "evidence",
    blurb: "What to learn, from whom, how, and by when.",
    ask: 'Sections: "What we need to learn" (the specific decisions this research will inform); "Method and why it fits"; "Who we need" as a table ["Segment","Why them","How many","How to reach them"]; "What we will do"; "Timeline"; "How findings will be used"; "What would make us stop early".' },
  { id: "interview_guide", name: "Interview Guide", familyId: "research", needs: "evidence",
    blurb: "A guide that surfaces behaviour, not opinions.",
    ask: 'Sections: "Objective"; "Screening criteria"; "Warm-up"; "Core questions" as a table ["Question","What it is really probing","Follow-up probes"]; "Closing"; "What NOT to ask" (leading questions and solution-pitching to avoid). Questions must ask about PAST BEHAVIOUR ("tell me about the last time…"), never about hypothetical future preference.' },
  { id: "survey", name: "Survey", familyId: "research", needs: "evidence",
    blurb: "Instrument with clean, unbiased items.",
    ask: 'Sections: "Objective and target n"; "Screener"; "Questions" as a table ["#","Question","Type","Scale / options","What it measures"]; "Analysis plan" (state before fielding what result means what); "Bias check" (leading wording, double-barrelled items, missing options).' },
  { id: "research_synthesis", name: "Research Synthesis", familyId: "research", needs: "synthesis",
    blurb: "Everything learned, in one interpreted document.",
    ask: 'Sections: "What we set out to learn"; "What we did" (sources and their limits); "Findings" as a table ["Finding","Evidence","Strength","So what"]; "Themes"; "Contradictions in the evidence"; "What we still do not know"; "Implications".' },

  /* discovery */
  { id: "problem_statement", name: "Problem Statement", familyId: "discovery", needs: "evidence",
    blurb: "One page: the problem, who has it, what it costs.",
    ask: 'Sections: "Problem" (one paragraph — who, when, what happens, what it costs); "Evidence" as a table ["Claim","Source","Strength"]; "Who is affected and how many"; "What we are NOT claiming"; "How we would know it is solved".' },
  { id: "opportunity_brief", name: "Opportunity Brief", familyId: "discovery", needs: "synthesis",
    blurb: "The opportunity, sized and evidenced.",
    ask: 'Sections: "The opportunity"; "Evidence it is real" as a table ["Signal","Source","Strength"]; "Who it is for"; "Size of the prize and how derived"; "Why now"; "What would have to be true"; "Confidence".' },
  { id: "personas", name: "Personas", familyId: "discovery", needs: "evidence",
    blurb: "Evidence-based user types, not invented ones.",
    ask: 'Sections: one section per persona with a table ["Attribute","Detail","Evidence basis"] covering context, goals, jobs, pains, current workaround and success criteria; then "How these differ in what they need from us"; "Where these are assumption rather than evidence".' },
  { id: "jtbd_map", name: "Jobs-to-be-Done Map", familyId: "discovery", needs: "evidence",
    blurb: "The progress users are trying to make.",
    ask: 'Sections: "Jobs" as a table ["Job statement (when… I want to… so I can…)","Who","Hired today","Struggling moment","Evidence"]; "The dominant job"; "Under-served steps in the job"; "Jobs we will not serve".' },
  { id: "journey_map", name: "Journey Map", familyId: "discovery", needs: "evidence",
    blurb: "Current-state experience, stage by stage.",
    ask: 'Sections: "Journey" as a table ["Stage","Goal","Actions","Touchpoints","Emotion","Friction","Evidence"] in order; "Moments that matter"; "Where it breaks"; "Steps inferred rather than observed".' },
  { id: "use_case_inventory", name: "Use-Case Inventory", familyId: "discovery", needs: "evidence",
    blurb: "Every use case in scope, classified.",
    ask: 'Sections: "Use cases" as a table ["Use case","Actor","Trigger","Outcome","Frequency","Value","In / out of scope"]; "Core set"; "Deliberately excluded".' },

  /* strategy */
  { id: "product_vision", name: "Product Vision", familyId: "strategy", needs: "synthesis",
    blurb: "Where this is going and what changes for users.",
    ask: 'Sections: "Vision" (short, concrete, describes a changed user reality — not adjectives); "Who it is for"; "What becomes true that is not true today"; "What we believe" as a table ["Belief","Evidence","Strength"]; "What we are not doing".' },
  { id: "product_strategy", name: "Product Strategy", familyId: "strategy", needs: "synthesis",
    blurb: "The bet, the reasoning, and the trade-offs taken.",
    ask: 'Sections: "The strategic question"; "Diagnosis" (what the evidence says is actually going on); "The bet" (one paragraph); "Why this and not the alternatives" as a table ["Alternative","Why not"]; "What this commits us to"; "What would make us change course"; "Confidence".' },
  { id: "strategic_options", name: "Strategic Options", familyId: "strategy", needs: "synthesis",
    blurb: "The genuinely different paths, compared.",
    ask: 'Sections: "Options" as a table ["Option","What it means","Upside","Downside","Effort","Reversibility","Evidence"] with a do-nothing row; "Comparison on what matters"; "Recommended option"; "Conditions under which another wins".' },

  /* market */
  { id: "market_assessment", name: "Market Assessment", familyId: "market", needs: "evidence",
    blurb: "Size, growth, segments — with sources.",
    ask: 'Sections: "Market definition"; "Sizing" as a table ["Layer","Basis","Value","Source","Date"]; "Segments"; "Growth drivers and barriers"; "Attractiveness read"; "Assumptions and their sensitivity". Every number sourced and dated, or omitted.' },
  { id: "competitive_landscape_doc", name: "Competitive Landscape", familyId: "market", needs: "evidence",
    blurb: "Every alternative and why customers choose it.",
    ask: 'Sections: "Alternative set" as a table ["Alternative","Type","Who picks it","Why","Weakness","Source"] including manual and do-nothing rows; "Why customers choose what they choose"; "Where we differentiate"; "Biggest competitive risk"; "Unverified claims".' },
  { id: "competitor_matrix", name: "Competitor Matrix", familyId: "market", needs: "evidence",
    blurb: "Capability-by-capability, sourced.",
    ask: 'Sections: "Matrix" as a table with capability rows, one column per alternative, and a final "Source / verified?" column; "Gaps that cost us"; "Parity that does not matter"; "What we could not verify".' },
  { id: "battlecard", name: "Battlecard", familyId: "market", needs: "evidence",
    blurb: "One competitor, for the people in the room.",
    ask: 'Sections: "Who they are and who they win with"; "Where they beat us" (honest); "Where we beat them"; "Objection handling" as a table ["They say","Truth","We say"]; "Traps to avoid"; "Do not claim" (things we cannot substantiate). Never put an unverifiable claim in a customer-facing document.' },
  { id: "positioning_rec", name: "Positioning Recommendation", familyId: "market", needs: "synthesis",
    blurb: "The claim we can defend.",
    ask: 'Sections: "Target"; "Frame of reference"; "Point of difference and the proof for it" as a table ["Claim","Proof","Strength"]; "What we give up by taking this position"; "Where this fails".' },

  /* decision */
  { id: "recommendation_memo", name: "Recommendation Memo", familyId: "decision", needs: "decision",
    blurb: "The call, the reasoning, the confidence.",
    ask: 'Sections: "Recommendation" (first, in one paragraph, with the confidence level stated); "Why" (the evidence chain); "Options considered" as a table ["Option","Benefits","Costs","Risks","Why not chosen"] with a do-nothing row; "What we are assuming"; "What would change this"; "What we need from you" (the specific decision or resource being asked for).' },
  { id: "decision_brief", name: "Decision Brief", familyId: "decision", needs: "decision",
    blurb: "Structured for a decision meeting.",
    ask: 'Sections: "The decision to be made"; "What we know" as a table ["Fact","Source","Strength"]; "What it means"; "Options and trade-offs" as a table; "Recommendation"; "Confidence and why"; "Evidence gaps"; "If we decide today vs wait — what changes".' },
  { id: "build_buy_doc", name: "Build vs Buy Analysis", familyId: "decision", needs: "decision",
    blurb: "Which path, and what it commits you to.",
    ask: 'Sections: "Capability required"; "Options" as a table ["Path","Time to value","Cost shape","Control","Risk","Fit"] for build / buy / partner; "Is this differentiating?"; "Recommendation"; "Reversal conditions"; "What we would need to verify with vendors".' },
  { id: "business_case", name: "Business Case", familyId: "decision", needs: "decision",
    blurb: "The investment case, assumptions exposed.",
    ask: 'Sections: "The ask" (what is being requested, in one line); "Problem and evidence"; "Proposed investment"; "Assumptions" as a table ["Assumption","Value","Basis","Confidence"]; "Financial model" as a table ["Line","Y1","Y2","Y3"]; "Sensitivity" (what breaks it); "Risks and mitigations"; "Recommendation and confidence". Never present a model as a forecast.' },

  /* definition */
  { id: "prd_feature", name: "Feature PRD", familyId: "definition", needs: "synthesis",
    blurb: "A single feature, defined precisely.",
    ask: 'Sections in order: "Overview"; "Problem & evidence" as a table ["Claim","Source","Strength"]; "Users"; "Goals & non-goals"; "User stories & acceptance criteria" as a table ["As a…","I want…","So that…","Acceptance criteria"]; "Functional requirements"; "Edge cases & error states"; "Non-functional requirements"; "Domain / compliance constraints"; "Dependencies & risks"; "Success metrics" as a table ["Metric","Baseline","Target","How measured"]; "Rollout"; "Open questions". Omit any section the evidence cannot support rather than padding it.' },
  { id: "prd_product", name: "Product PRD", familyId: "definition", needs: "synthesis",
    blurb: "A whole product, end to end.",
    ask: 'Sections in order: "Executive summary"; "Business context & objectives"; "Target users & personas" as a table ["Persona","Job","Needs","Pains","Evidence"]; "Problem statement"; "Market & competitive landscape" as a table; "Product vision & strategy"; "Scope — in / out"; "Key epics" as a table ["Epic","User value","Priority","Evidence"]; "Functional requirements"; "Non-functional requirements"; "Domain, privacy & compliance"; "Success metrics & KPIs" as a table ["Metric","Baseline","Target","How measured"]; "Rollout & GTM"; "Risks, dependencies & assumptions"; "Milestones"; "Open questions".' },
  { id: "mvp_definition", name: "MVP Definition", familyId: "definition", needs: "synthesis",
    blurb: "The smallest thing that tests the belief.",
    ask: 'Sections: "The belief this MVP tests"; "What is in" as a table ["Capability","Why it is essential to the test"]; "What is out and why"; "What we will learn"; "Success / kill criteria stated in advance"; "What this MVP deliberately does badly". An MVP that cannot fail is not an MVP — be explicit about the failing condition.' },
  { id: "feature_brief", name: "Feature Brief", familyId: "definition", needs: "synthesis",
    blurb: "One page for a small, clear piece of work.",
    ask: 'Sections: "What and why" (short); "Evidence"; "Scope"; "Acceptance criteria"; "Metrics"; "Risks"; "Open questions".' },

  /* backlog */
  { id: "backlog_prioritized", name: "Prioritized Backlog", familyId: "backlog", needs: "synthesis",
    blurb: "Ranked items with evidence and criteria.",
    ask: 'Sections: "How this was prioritised" (name the method and why it suits the evidence available); "Backlog" as a table ["#","Item","User value","Evidence","Effort","Priority (Now/Next/Later)"] ordered by priority; "Now"; "Next"; "Later"; "Not doing yet and why".' },
  { id: "user_stories", name: "User Stories", familyId: "backlog", needs: "synthesis",
    blurb: "Stories with real acceptance criteria.",
    ask: 'Sections: "Stories" as a table ["ID","As a…","I want…","So that…","Acceptance criteria (Given/When/Then)","Evidence"]; "Sequencing note"; "Stories that need more evidence before refinement". Each story must be independently valuable and testable.' },
  { id: "epics", name: "Themes & Epics", familyId: "backlog", needs: "synthesis",
    blurb: "The structure above the stories.",
    ask: 'Sections: "Themes" as a table ["Theme","Outcome it serves","Epics","Evidence"]; "Epic detail" (one short section per epic: value, scope, key stories); "Sequencing rationale".' },

  /* prioritization */
  { id: "rice_assessment", name: "RICE Assessment", familyId: "prioritization", needs: "synthesis",
    blurb: "Scored, with the reach basis visible.",
    ask: 'Sections: "Method note" (is our reach data real? if not, say the scores are relative only); "Scoring" as a table ["Item","Reach (basis)","Impact","Confidence","Effort","Score"] ordered by score; "Ranked output"; "Fragility" (the one assumption that would reorder this).' },
  { id: "priority_matrix", name: "Priority Matrix", familyId: "prioritization", needs: "synthesis",
    blurb: "Impact against effort, with the quadrants named.",
    ask: 'Sections: "Placement" as a table ["Item","Impact","Effort","Quadrant","Evidence"]; "Quick wins"; "Big bets"; "Fill-ins"; "Money pits (do not do)".' },
  { id: "opportunity_backlog", name: "Ranked Opportunity Backlog", familyId: "prioritization", needs: "synthesis",
    blurb: "Opportunities, not solutions, in rank order.",
    ask: 'Sections: "Opportunities" as a table ["Opportunity (a user need, never a feature)","Evidence","Value","Confidence","Rank"]; "Top opportunities"; "Candidate solutions per top opportunity"; "What to validate first".' },

  /* roadmap */
  { id: "roadmap_nnl", name: "Now / Next / Later", familyId: "roadmap", needs: "synthesis",
    blurb: "Horizons without false date precision.",
    ask: 'Sections: "Now" / "Next" / "Later" — each a table ["Item","Outcome it serves","Confidence","What we will learn"]; "What moves an item from Later to Now"; "What is deliberately not on this roadmap".' },
  { id: "roadmap_quarterly", name: "Quarterly Roadmap", familyId: "roadmap", needs: "synthesis",
    blurb: "Quarter by quarter, tied to outcomes.",
    ask: 'Sections: one per quarter as a table ["Outcome","Initiatives","Success measure","Dependencies","Confidence"]; "Assumptions this plan rests on"; "Where confidence drops off". Do not imply precision beyond the evidence — later quarters should visibly carry lower confidence.' },
  { id: "capability_roadmap", name: "Capability Roadmap", familyId: "roadmap", needs: "synthesis",
    blurb: "The capabilities to build, in order.",
    ask: 'Sections: "Capabilities" as a table ["Capability","Why needed","Depends on","Horizon"]; "Sequencing logic"; "Platform investments that unlock the rest".' },

  /* experiment */
  { id: "experiment_brief", name: "Experiment Brief", familyId: "experiment", needs: "synthesis",
    blurb: "One risky assumption, one cheap test.",
    ask: 'Sections: "Assumption being tested"; "Hypothesis" (falsifiable, with the expected effect); "Design" as a table ["Element","Choice","Rationale"] covering population, variants, primary metric, guardrails, duration and sample; "Decision rule" (stated before running: what result means ship / iterate / kill); "Threats to validity"; "Cost of running it".' },
  { id: "measurement_plan", name: "Measurement Plan", familyId: "experiment", needs: "synthesis",
    blurb: "What to instrument, before you need it.",
    ask: 'Sections: "Questions we need to answer"; "Events" as a table ["Event","Properties","Triggered when","Question it answers"]; "Metrics derived"; "Baselines needed"; "What we cannot currently measure".' },

  /* metrics */
  { id: "north_star", name: "North Star & KPI Tree", familyId: "metrics", needs: "synthesis",
    blurb: "One outcome metric with its inputs beneath it.",
    ask: 'Sections: "North Star" (one metric, with why it represents delivered value rather than activity); "Input metrics" as a table ["Input","How it moves the North Star","Owner","Current baseline"]; "Guardrail metrics" (what must not get worse); "Anti-metrics" (numbers that would look good while the product got worse); "Instrumentation gaps".' },
  { id: "success_metrics", name: "Success Metrics", familyId: "metrics", needs: "synthesis",
    blurb: "How we will know this worked.",
    ask: 'Sections: "Metrics" as a table ["Metric","Why it matters","Baseline","Target","How measured","When we will know"]; "Guardrails"; "Where no baseline exists yet".' },
  { id: "scorecard", name: "Product Scorecard", familyId: "metrics", needs: "synthesis",
    blurb: "A recurring read on product health.",
    ask: 'Sections: "Scorecard" as a table ["Area","Metric","Current","Target","Trend","Read"]; "Where we are weakest"; "What to watch next period".' },

  /* quality */
  { id: "defect_assessment", name: "Defect Assessment", familyId: "quality", needs: "evidence",
    blurb: "What is broken and what it is costing.",
    ask: 'Sections: "Defect profile" as a table ["Cluster","Type","Severity","Frequency","Customer impact","Root cause"] ordered by impact; "Systemic vs isolated"; "Cost of the current state"; "Fix sequence"; "Data we are missing".' },
  { id: "rca_doc", name: "Root Cause Analysis", familyId: "quality", needs: "evidence",
    blurb: "Why it happened, and what stops it recurring.",
    ask: 'Sections: "What happened"; "Timeline"; "Causal chain" as a table ["Step","What happened","Why","Evidence"]; "Root cause"; "Contributing factors"; "Why it was not caught earlier"; "Corrective actions" as a table ["Action","Type (prevent / detect / mitigate)","Owner"]; "How we will know it worked". Do not stop at the proximate cause.' },
  { id: "quality_plan", name: "Quality Improvement Plan", familyId: "quality", needs: "evidence",
    blurb: "The programme to fix a class of problems.",
    ask: 'Sections: "Current state and evidence"; "Target state"; "Actions" as a table ["Action","Addresses","Effort","Expected effect"]; "Sequence"; "Measurement".' },

  /* launch */
  { id: "launch_plan", name: "Launch Plan", familyId: "launch", needs: "synthesis",
    blurb: "Readiness, rollout and gates.",
    ask: 'Sections: "What is launching and to whom"; "Readiness criteria" as a table ["Area","Criterion","Owner","Status"]; "Rollout stages" as a table ["Stage","Audience","Entry criteria","Exit / go-no-go","Rollback trigger"]; "Enablement"; "Comms"; "Success measures"; "What would make us stop".' },
  { id: "gtm_plan", name: "GTM Plan", familyId: "launch", needs: "synthesis",
    blurb: "Audience, message, motion.",
    ask: 'Sections: "Target audience and why now"; "Positioning and message"; "Proof points" as a table ["Claim","Proof","Verified?"]; "Channels and motion"; "Enablement needs"; "Success measures"; "Risks".' },
  { id: "adoption_plan", name: "Adoption Strategy", familyId: "launch", needs: "synthesis",
    blurb: "Getting from shipped to used.",
    ask: 'Sections: "Adoption barriers" as a table ["Barrier","Evidence","Intervention"]; "Adoption path" (the steps a user takes from unaware to habitual); "Interventions per step"; "Measurement"; "Where adoption most likely stalls".' },

  /* operating */
  { id: "workflow_design", name: "Workflow Design", familyId: "operating", needs: "synthesis",
    blurb: "The future-state process, step by step.",
    ask: 'Sections: "Current state" as a table ["Step","Actor","System","Time","Pain"]; "Future state" as the same table; "What changed and what it saves"; "Exceptions and how they are handled"; "What this requires of people, not just software".' },
  { id: "raci", name: "RACI", familyId: "operating", needs: "synthesis",
    blurb: "Who decides, who does, who is told.",
    ask: 'Sections: "RACI" as a table with activities as rows and roles as columns; "Decision rights" (who has final say on what); "Where accountability is currently unclear". Exactly one Accountable per row — flag any row where that is not true today.' },
  { id: "operating_model", name: "Operating Model", familyId: "operating", needs: "synthesis",
    blurb: "How the team runs this ongoing.",
    ask: 'Sections: "Structure"; "Cadence" as a table ["Ceremony","Purpose","Who","Frequency","Output"]; "Decision rights"; "Interfaces with other teams"; "What breaks at scale".' },

  /* exec */
  { id: "executive_summary", name: "Executive Summary", familyId: "exec", needs: "decision",
    blurb: "The answer first, in one page.",
    ask: 'Sections: "The answer" (one short paragraph: what we found and what we recommend, with confidence); "Why" (3-5 bullets, each carrying its evidence strength); "What we need"; "Risks"; "What we would know more about in 30 days". Under one page. No methodology narration.' },
  { id: "one_pager", name: "One-Pager", familyId: "exec", needs: "synthesis",
    blurb: "The whole thing on one page.",
    ask: 'Sections: "In one line"; "The problem and the evidence"; "What we propose"; "Why it will work"; "What it costs"; "Confidence and gaps". Ruthlessly short.' },
  { id: "leadership_memo", name: "Leadership Memo", familyId: "exec", needs: "decision",
    blurb: "Narrative memo for a leadership audience.",
    ask: 'Sections: "Summary" (answer first); "Context"; "What the evidence shows"; "What we recommend"; "Trade-offs we are accepting"; "What we are asking for"; "Confidence and what would change it". Prose, not bullets — a memo people read start to finish.' },
  { id: "status_update", name: "Status Update", familyId: "exec", needs: "evidence",
    blurb: "Where things stand, honestly.",
    ask: 'Sections: "Where we are"; "What we learned"; "What changed since last time"; "Risks and blockers"; "Next". Lead with anything that is off-track.' },
  { id: "talking_points", name: "Talking Points", familyId: "exec", needs: "decision",
    blurb: "What to say, and what to avoid claiming.",
    ask: 'Sections: "Key messages" (3-5, each in a sentence someone could actually say); "Supporting evidence" as a table ["Message","Proof","Strength"]; "Likely questions and answers"; "Do not claim" (anything unverified). ' },
  { id: "slide_storyline", name: "Slide Storyline", familyId: "exec", needs: "decision",
    blurb: "The argument, one message per slide.",
    ask: 'Sections: one per slide as a table ["Slide","Headline (the message, as a full sentence)","Supporting content","Evidence"]; then "The through-line" (the argument the sequence makes). Each headline must be an assertion, never a topic label.' },
];

export function getOutput(id: string): OutputDef | undefined {
  return OUTPUTS.find((o) => o.id === id);
}
export function getOutputFamily(id: string): OutputFamily | undefined {
  return OUTPUT_FAMILIES.find((f) => f.id === id);
}
export function outputAsk(o: OutputDef): string {
  return o.ask ?? getOutputFamily(o.familyId)?.defaultAsk ?? "";
}
