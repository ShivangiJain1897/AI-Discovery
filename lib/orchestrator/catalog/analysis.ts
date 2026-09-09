/**
 * LAYER 2 — ANALYTICAL METHODS (spec Step 4).
 *
 * Research gathers evidence; analysis reasons over it. The two are never
 * confused: "competitive research" is Layer 1, "SWOT" is Layer 2.
 *
 * Methods are grouped into families. Each method may define its own `ask`
 * (the exact sections and tables it should produce); where it doesn't, the
 * family's default shape is used. That keeps the long tail of methods usable
 * without pretending every one needs a bespoke template.
 *
 * NOTE ON PRIORITIZATION: never reach for RICE because it is popular. Pick the
 * method the available evidence can actually support — see `evidenceNeeded`.
 */

export interface MethodFamily {
  id: string;
  name: string;
  /** What questions this family of methods answers. */
  blurb: string;
  /** Default section shape for methods in this family with no bespoke `ask`. */
  defaultAsk: string;
}

export interface AnalysisMethod {
  id: string;
  name: string;
  familyId: string;
  blurb: string;
  /** The methodology label stamped on the output. */
  method: string;
  /** What evidence this method needs to be honest — shown before it's chosen. */
  evidenceNeeded: string;
  /** Bespoke section spec; falls back to the family default. */
  ask?: string;
}

export const METHOD_FAMILIES: MethodFamily[] = [
  {
    id: "problem",
    name: "Problem & Root Cause",
    blurb: "Separate symptoms from causes before anyone proposes a solution.",
    defaultAsk:
      'Sections: "Framing" (what is actually being asked); a central analysis table with one row per element, always including an evidence and a confidence column; "What this tells us"; "What to validate first".',
  },
  {
    id: "customer",
    name: "Customer & User",
    blurb: "Who this is for, what they are trying to get done, and where it hurts.",
    defaultAsk:
      'Sections: "Who this covers"; a table with one row per segment/persona/job including its evidence basis; "Where the sharpest need is"; "What we still do not know about these users".',
  },
  {
    id: "voc",
    name: "Voice of Customer",
    blurb: "Turn raw feedback into themes, severity and signal.",
    defaultAsk:
      'Sections: "Method and corpus" (what feedback this rests on and its size/limits); a theme table ["Theme","What customers say","Frequency","Severity","Evidence"]; "Emerging vs established themes"; "What the feedback cannot tell us".',
  },
  {
    id: "performance",
    name: "Product Performance",
    blurb: "What the behavioural data says about how the product is doing.",
    defaultAsk:
      'Sections: "Baseline" (the numbers this rests on, or the fact that none were supplied); a metric table ["Stage/Metric","Value","Reference point","Read"]; "Where the loss is concentrated"; "Instrumentation gaps". Never invent a number; if none was supplied, specify exactly what to instrument.',
  },
  {
    id: "quality",
    name: "Product Quality",
    blurb: "Which defects matter, why they recur, and what they are costing.",
    defaultAsk:
      'Sections: "Defect profile"; a table ["Cluster","Type","Severity","Frequency","Customer impact","Likely root cause"] ordered by severity x frequency; "Systemic vs isolated"; "Corrective actions".',
  },
  {
    id: "market",
    name: "Market",
    blurb: "How big, how fast, how attractive — with the arithmetic shown.",
    defaultAsk:
      'Sections: "Definition" (what is being sized/assessed and the boundary); a table showing the derivation with a source column; "Attractiveness read"; "Assumptions and their sensitivity". Show every calculation; an unsourced number is not permitted.',
  },
  {
    id: "competitive",
    name: "Competitive",
    blurb: "Where you stand against every alternative, including doing nothing.",
    defaultAsk:
      'Sections: "The set of alternatives considered" (including manual/DIY/do-nothing); a comparison table with an evidence column; "Where we win / where we lose"; "White space".',
  },
  {
    id: "strategy",
    name: "Strategy",
    blurb: "What position to take and what capability the choice demands.",
    defaultAsk:
      'Sections: "Strategic question"; the framework table with an evidence column; "Strategic implications"; "What this commits us to".',
  },
  {
    id: "opportunity",
    name: "Opportunity",
    blurb: "Where value is available and how much of it is real.",
    defaultAsk:
      'Sections: "Opportunity set"; a table ["Opportunity","Underlying need","Evidence","User value","Business value","Confidence"]; "Where the value concentrates"; "What would have to be true".',
  },
  {
    id: "prioritization",
    name: "Prioritization",
    blurb: "What to do first — with the scoring logic visible, not hidden.",
    defaultAsk:
      'Sections: "Why this method fits the evidence we have"; the scoring table with every input column shown; "Ranked output"; "What NOT to do yet and why". Show the reasoning behind every score; never let a number launder a weak assumption.',
  },
  {
    id: "business",
    name: "Business & Financial",
    blurb: "Whether the money works, under stated assumptions.",
    defaultAsk:
      'Sections: "Model and its assumptions" (every assumption listed and labelled); the calculation table; "Low / Base / High"; "What breaks it". Never imply precision you do not have.',
  },
  {
    id: "experimentation",
    name: "Experimentation",
    blurb: "How to find out cheaply before committing.",
    defaultAsk:
      'Sections: "Hypothesis" (stated so it can be falsified); "Design" as a table ["Element","Choice","Rationale"] covering population, variants, primary metric, guardrail metrics, duration, sample; "Decision rule" (what result means ship / iterate / kill); "Threats to validity".',
  },
  {
    id: "risk",
    name: "Risk",
    blurb: "What could stop this working, and what to do about it.",
    defaultAsk:
      'Sections: "Risk register" as a table ["Risk","Type","Likelihood","Impact","Early warning signal","Mitigation / owner"] ordered by likelihood x impact; "Top three risks"; "Risks we are accepting deliberately".',
  },
  {
    id: "delivery",
    name: "Delivery",
    blurb: "What order it can be built in and what it depends on.",
    defaultAsk:
      'Sections: "Sequencing logic"; a table ["Item","Depends on","Blocks","Why it sits here"]; "Critical path"; "Where the plan is fragile".',
  },
  {
    id: "ai",
    name: "AI Product Analysis",
    blurb: "Whether the AI part will actually be trusted and affordable.",
    defaultAsk:
      'Sections: "What the AI is being asked to do"; a table ["Dimension","Target","How measured","Current read"] covering accuracy, groundedness, relevance, hallucination rate, completion rate, escalation rate, latency, cost per interaction and safety; "Human-in-the-loop design"; "Trust and failure handling"; "Evaluation plan".',
  },
  {
    id: "foresight",
    name: "Scenario & Foresight",
    blurb: "How the decision holds up if the world moves.",
    defaultAsk:
      'Sections: "Scenarios" as a table ["Scenario","What would have to happen","Impact on this decision","Leading indicator"] covering best / base / worst; "Which assumptions the outcome is most sensitive to"; "What we would watch for".',
  },
];

export const ANALYSIS_METHODS: AnalysisMethod[] = [
  /* ---------------------------- Problem & Root Cause --------------------- */
  {
    id: "problem_framing",
    name: "Problem Framing",
    familyId: "problem",
    method: "Problem framing",
    blurb: "State the real problem, for whom, and how we'd know it was solved.",
    evidenceNeeded: "The request itself; any user or behavioural signal.",
    ask: 'Sections: "Problem Statement" (one paragraph: who, what, when, what it costs them); "Symptom vs Problem" as a table ["Stated symptom","Underlying problem","Evidence","Confidence"]; "Who is affected and how much"; "What solving it would look like" (observable, not aspirational); "What this problem is NOT" (explicitly out of frame).',
  },
  {
    id: "five_whys",
    name: "5 Whys",
    familyId: "problem",
    method: "5 Whys",
    blurb: "Chain from symptom to cause, one honest step at a time.",
    evidenceNeeded: "A specific observed failure or drop-off.",
    ask: 'Sections: "Starting symptom"; "The chain" as a table ["#","Why?","Answer","Evidence for this step","Confidence"] with up to 5 steps; "Where the chain becomes speculation" (be explicit about which link stops being evidence-backed); "Root cause candidate"; "How to test it".',
  },
  {
    id: "issue_tree",
    name: "Issue Tree",
    familyId: "problem",
    method: "MECE issue tree",
    blurb: "Decompose the question into mutually exclusive, exhaustive parts.",
    evidenceNeeded: "A well-formed question; decomposable metric or outcome.",
    ask: 'Sections: "Top question"; "Decomposition" as a table ["Branch","Sub-question","What would answer it","Evidence we have"]; "Where the biggest unknown sits"; "Recommended order of investigation". The branches must be mutually exclusive and collectively exhaustive — say so if they are not.',
  },
  {
    id: "root_cause",
    name: "Root Cause Analysis",
    familyId: "problem",
    method: "Hypothesis grid",
    blurb: "Rank competing explanations by what supports and contradicts each.",
    evidenceNeeded: "Symptoms from two or more independent sources.",
    ask: 'Sections: "Candidate causes" as a table ["Hypothesis","Supporting evidence","Contradicting evidence","Confidence","Cheapest test"] ordered by confidence; "Most likely cause(s)"; "What would change our mind". Never claim causation from correlation; if the evidence only supports association, say so in the row.',
  },
  {
    id: "failure_mode",
    name: "Failure-Mode Analysis",
    familyId: "problem",
    method: "FMEA",
    blurb: "Where it can break, how badly, and whether you'd notice.",
    evidenceNeeded: "A described flow, system or process.",
    ask: 'Sections: "Scope of the analysis"; "Failure modes" as a table ["Step","Failure mode","Effect on user","Severity","Likelihood","Detectability","Mitigation"] ordered by severity x likelihood / detectability; "Undetected failures" (the dangerous ones); "Priority mitigations".',
  },

  /* ------------------------------- Customer ------------------------------ */
  {
    id: "jtbd",
    name: "Jobs to be Done",
    familyId: "customer",
    method: "Jobs-to-be-Done",
    blurb: "The progress users are trying to make, and what they hire today.",
    evidenceNeeded: "User evidence — interviews, tickets, reviews or transcripts.",
    ask: 'Sections: "Jobs" as a table ["Job (when… I want to… so I can…)","Who has it","Hired today","Struggling moment","Evidence"]; "The dominant job"; "Where the current solution under-serves"; "Jobs we are choosing not to serve".',
  },
  {
    id: "personas",
    name: "Persona Analysis",
    familyId: "customer",
    method: "Evidence-based personas",
    blurb: "The distinct user types, grounded in evidence rather than invention.",
    evidenceNeeded: "User research or behavioural segmentation. Without it, personas are fiction.",
    ask: 'Sections: "Segments identified"; a table ["Persona","Context & goals","Key needs","Pains","Success looks like","Evidence basis"]; "Who we optimise for first and why"; "Where these personas are assumption, not evidence".',
  },
  {
    id: "journey",
    name: "Journey Analysis",
    familyId: "customer",
    method: "Journey mapping",
    blurb: "The end-to-end experience and the moments that decide the outcome.",
    evidenceNeeded: "A described flow plus any drop-off or feedback signal.",
    ask: 'Sections: "Current-state journey" as a table ["Stage","User goal","Action / touchpoint","What they feel","Friction","Evidence"] in order; "Moments that matter" (the few that determine the outcome); "Highest-friction stage and why"; "Steps that are inferred, not observed".',
  },
  {
    id: "segmentation",
    name: "Segmentation",
    familyId: "customer",
    method: "Needs-based segmentation",
    blurb: "Cut the user base by need or behaviour, not by demographics.",
    evidenceNeeded: "Behavioural or needs data across more than one user type.",
  },
  {
    id: "unmet_needs",
    name: "Unmet Needs Analysis",
    familyId: "customer",
    method: "Importance vs satisfaction",
    blurb: "Where importance is high and satisfaction is low — the real gaps.",
    evidenceNeeded: "Signals of both importance and current satisfaction.",
    ask: 'Sections: "Needs assessed" as a table ["Need","Importance","Current satisfaction","Gap","Evidence"] ordered by gap; "The underserved needs"; "Overserved areas we could stop investing in"; "What would confirm this ranking".',
  },
  {
    id: "pain_analysis",
    name: "Pain-Point Analysis",
    familyId: "customer",
    method: "Pain severity mapping",
    blurb: "Which pains actually cost the user something.",
    evidenceNeeded: "Qualitative feedback, tickets or observation.",
  },

  /* ---------------------------- Voice of Customer ------------------------ */
  {
    id: "thematic",
    name: "Thematic Analysis",
    familyId: "voc",
    method: "Thematic coding",
    blurb: "Cluster raw feedback into themes with frequency and severity.",
    evidenceNeeded: "A body of verbatim feedback — tickets, reviews, transcripts.",
  },
  {
    id: "sentiment",
    name: "Sentiment Analysis",
    familyId: "voc",
    method: "Sentiment distribution",
    blurb: "Where feeling is strongest, and about what.",
    evidenceNeeded: "Enough verbatim feedback for distribution to mean anything.",
  },
  {
    id: "request_categorization",
    name: "Request Categorization",
    familyId: "voc",
    method: "Request → need mapping",
    blurb: "Translate feature requests back into the need behind them.",
    evidenceNeeded: "A set of feature requests or asks.",
    ask: 'Sections: "Requests as received" as a table ["Request as asked","Underlying need","Why they asked for THIS solution","Better ways to serve the need","Frequency"]; "Requests that share one root need"; "Requests we should decline and what to say". Never build the literal request without stating the need it serves.',
  },
  {
    id: "emerging_themes",
    name: "Emerging-Theme Detection",
    familyId: "voc",
    method: "Trend-over-time coding",
    blurb: "What is newly appearing in feedback, versus long-standing noise.",
    evidenceNeeded: "Feedback spanning more than one time period.",
  },

  /* --------------------------- Product Performance ---------------------- */
  {
    id: "funnel",
    name: "Funnel Analysis",
    familyId: "performance",
    method: "Funnel decomposition",
    blurb: "Where users are lost, stage by stage.",
    evidenceNeeded: "Stage-by-stage conversion data. Without it this is a map, not an analysis.",
    ask: 'Sections: "Funnel definition" (the stages and how each is measured); "Stage performance" as a table ["Stage","Entering","Converting","Drop-off","Likely reason","Evidence"]; "Where the loss concentrates"; "What we cannot see with current instrumentation". If no data was supplied, produce the funnel definition and the instrumentation plan, and state plainly that the numbers are missing.',
  },
  {
    id: "cohort",
    name: "Cohort Analysis",
    familyId: "performance",
    method: "Cohort comparison",
    blurb: "How behaviour differs by when or how users arrived.",
    evidenceNeeded: "Usage data split by cohort.",
  },
  {
    id: "retention",
    name: "Retention Analysis",
    familyId: "performance",
    method: "Retention curve",
    blurb: "Who comes back, when the curve flattens, and who never returns.",
    evidenceNeeded: "Repeat-usage data over time.",
  },
  {
    id: "activation",
    name: "Activation & Adoption",
    familyId: "performance",
    method: "Activation milestone analysis",
    blurb: "What first-run success looks like and how many reach it.",
    evidenceNeeded: "First-session and early-usage data, or a defined activation moment.",
  },
  {
    id: "churn",
    name: "Churn Analysis",
    familyId: "performance",
    method: "Churn driver analysis",
    blurb: "Why users leave, and which reasons are addressable.",
    evidenceNeeded: "Churn events plus a reason signal (survey, behaviour or CS notes).",
  },
  {
    id: "feature_usage",
    name: "Feature Usage",
    familyId: "performance",
    method: "Usage distribution",
    blurb: "What gets used, by whom, how often — and what doesn't.",
    evidenceNeeded: "Per-feature event data.",
  },

  /* ----------------------------- Product Quality ------------------------ */
  {
    id: "defect_pareto",
    name: "Defect Pareto",
    familyId: "quality",
    method: "Pareto analysis",
    blurb: "The few defect classes causing most of the pain.",
    evidenceNeeded: "Defect or ticket volumes by category.",
    ask: 'Sections: "Defect distribution" as a table ["Cluster","Share of volume","Cumulative share","Customer impact","Root cause"] ordered by share; "The vital few" (the clusters covering the bulk of volume); "Fix sequence and why"; "Where the data is incomplete".',
  },
  {
    id: "severity_frequency",
    name: "Severity × Frequency",
    familyId: "quality",
    method: "Severity x frequency matrix",
    blurb: "Rank issues by how bad and how often — not by who shouted.",
    evidenceNeeded: "Issue list with impact and recurrence signals.",
  },
  {
    id: "defect_clustering",
    name: "Defect Clustering",
    familyId: "quality",
    method: "Issue clustering",
    blurb: "Group symptoms that share one underlying cause.",
    evidenceNeeded: "A body of individual issues or tickets.",
  },

  /* --------------------------------- Market ----------------------------- */
  {
    id: "tam_sam_som",
    name: "TAM / SAM / SOM",
    familyId: "market",
    method: "Top-down + bottom-up sizing",
    blurb: "Size the market with the arithmetic on the page.",
    evidenceNeeded: "A sourced population base and a defensible price point. Without both, do not size.",
    ask: 'Sections: "Definition and boundary" (what counts as in-market); "Sizing" as a table ["Layer","Population / basis","Rate or price","Value","Source"] for TAM, SAM and SOM; "Bottom-up cross-check" (derive the same number a second way and reconcile the difference); "Assumptions and sensitivity" (which assumption moves the answer most). If the base cannot be sourced, do NOT produce a number — state what source would provide it.',
  },
  {
    id: "market_attractiveness",
    name: "Market Attractiveness",
    familyId: "market",
    method: "Attractiveness scoring",
    blurb: "Whether this market is worth entering at all.",
    evidenceNeeded: "Market size/growth signals and competitive intensity.",
  },
  {
    id: "market_growth",
    name: "Growth & Maturity",
    familyId: "market",
    method: "Category lifecycle",
    blurb: "Where the category sits on its curve and what that implies.",
    evidenceNeeded: "Historical market or adoption data.",
  },

  /* ------------------------------- Competitive -------------------------- */
  {
    id: "competitive_landscape",
    name: "Competitive Landscape",
    familyId: "competitive",
    method: "Alternatives landscape",
    blurb: "Every alternative a customer could pick, and why they'd pick it.",
    evidenceNeeded: "Competitive research, review data, or win/loss signals.",
    ask: 'Sections: "The alternative set" as a table ["Alternative","Type (direct / indirect / substitute / manual / do-nothing)","Who picks it","Why they pick it","Where it falls down","Evidence"] — the manual and do-nothing rows are mandatory; "Why customers choose what they choose" (the buying reason, not the feature list); "Where we are genuinely differentiated"; "Biggest competitive risk".',
  },
  {
    id: "feature_comparison",
    name: "Feature Comparison",
    familyId: "competitive",
    method: "Capability matrix",
    blurb: "Capability-by-capability, with sources — the least of competitive work.",
    evidenceNeeded: "Verifiable competitor capability information.",
    ask: 'Sections: "Comparison" as a table with capabilities as rows and each alternative as a column, plus a final "Source / verified?" column; "Gaps that actually cost us deals"; "Parity items that do not matter"; "Unverified claims" (anything in the table we could not source). Do not assert a competitor capability you cannot source.',
  },
  {
    id: "positioning",
    name: "Positioning Analysis",
    familyId: "competitive",
    method: "Positioning statement + map",
    blurb: "The claim you can defend, against the alternatives that exist.",
    evidenceNeeded: "Competitive set plus a clear target segment.",
  },
  {
    id: "pricing_comparison",
    name: "Pricing Comparison",
    familyId: "competitive",
    method: "Pricing & packaging comparison",
    blurb: "How the category charges, and where that leaves you.",
    evidenceNeeded: "Published or verified competitor pricing.",
  },
  {
    id: "whitespace",
    name: "White-Space Analysis",
    familyId: "competitive",
    method: "Need x coverage grid",
    blurb: "Needs that are real and unserved by anyone.",
    evidenceNeeded: "Both a needs view and a competitive coverage view.",
    ask: 'Sections: "Grid" as a table ["Need","Evidence it is real","Who serves it today","How well","Gap"]; "True white space" (high need, poor coverage) with the evidence for each; "Empty for a reason" (gaps that exist because the need is not real or not monetisable — be honest here); "Where to move first".',
  },

  /* -------------------------------- Strategy ---------------------------- */
  {
    id: "swot",
    name: "SWOT / TOWS",
    familyId: "strategy",
    method: "SWOT with TOWS actions",
    blurb: "Internal and external factors turned into strategic moves.",
    evidenceNeeded: "Both an internal (capability) and external (market) view.",
    ask: 'Sections: "SWOT" as a table ["Type (S/W/O/T)","Statement","Evidence","Confidence"] — Strengths and Weaknesses are INTERNAL and must be things we control; Opportunities and Threats are EXTERNAL and must be things we do not; "TOWS actions" as a table ["Pairing (S-O / S-T / W-O / W-T)","Strategic move","Why now"]; "The two moves that matter most". A SWOT that stops at four lists has done no work — the TOWS section is the point.',
  },
  {
    id: "five_forces",
    name: "Porter's Five Forces",
    familyId: "strategy",
    method: "Five Forces",
    blurb: "Where structural power sits in this market.",
    evidenceNeeded: "Market structure and competitive information.",
    ask: 'Sections: "Forces" as a table ["Force","Strength (High/Med/Low)","Why","Evidence"] covering rivalry, new entrants, substitutes, buyer power and supplier power; "Where profit pools sit"; "What this means for our strategy"; "The force most likely to change".',
  },
  {
    id: "capability_gap",
    name: "Capability-Gap Analysis",
    familyId: "strategy",
    method: "Required vs current capability",
    blurb: "What we'd need to be good at, and whether we are.",
    evidenceNeeded: "A stated strategic intent plus an honest internal view.",
  },
  {
    id: "build_buy_partner",
    name: "Build / Buy / Partner",
    familyId: "strategy",
    method: "Build-buy-partner comparison",
    blurb: "Which path to capability, and what each one costs you.",
    evidenceNeeded: "Feasibility view plus vendor/partner options.",
    ask: 'Sections: "What capability is actually needed"; "Options" as a table ["Path","What it takes","Time to value","Cost shape","Strategic control","Risk"] with one row each for Build, Buy and Partner; "Is this differentiating?" (build only what differentiates; buy undifferentiated heavy lifting); "Recommendation and the condition that would reverse it".',
  },
  {
    id: "strategic_options",
    name: "Strategic Options",
    familyId: "strategy",
    method: "Options comparison",
    blurb: "The genuinely different paths available, compared honestly.",
    evidenceNeeded: "Enough evidence to characterise more than one path.",
  },

  /* ------------------------------ Opportunity --------------------------- */
  {
    id: "ost",
    name: "Opportunity Solution Tree",
    familyId: "opportunity",
    method: "Opportunity Solution Tree",
    blurb: "Outcome → opportunities → solutions → tests, in one structure.",
    evidenceNeeded: "A defined outcome plus user opportunities from research.",
    ask: 'Sections: "Desired outcome" (one measurable outcome); "Tree" as a table ["Opportunity","Evidence it is real","Candidate solutions","Assumption to test first"] with opportunities as the rows; "The branch to pursue first and why"; "Opportunities we are deliberately parking". Opportunities are user needs/pains, NEVER solutions — if a row reads like a feature, rewrite it as the need underneath.',
  },
  {
    id: "opportunity_sizing",
    name: "Opportunity Sizing",
    familyId: "opportunity",
    method: "Value-pool sizing",
    blurb: "How much is actually on the table behind each opportunity.",
    evidenceNeeded: "A population base and a value-per-unit basis.",
  },
  {
    id: "value_pools",
    name: "Value Pools",
    familyId: "opportunity",
    method: "Value-pool mapping",
    blurb: "Where value accumulates in the chain — and who captures it.",
    evidenceNeeded: "Market structure plus economics of the workflow.",
  },

  /* ---------------------------- Prioritization -------------------------- */
  {
    id: "rice",
    name: "RICE",
    familyId: "prioritization",
    method: "RICE",
    blurb: "Reach × Impact × Confidence ÷ Effort. Only honest with real reach data.",
    evidenceNeeded: "Reach estimates grounded in usage data. Without them RICE is false precision.",
    ask: 'Sections: "Why RICE and its limits here" (say plainly whether we have real reach data; if not, say the scores are relative, not absolute); "Scoring" as a table ["Item","Reach (basis)","Impact","Confidence","Effort","RICE score","Evidence"] ordered by score, where the Reach cell shows the basis not just a number; "Ranked output"; "Where the ranking is fragile" (which single assumption would reorder it).',
  },
  {
    id: "ice",
    name: "ICE",
    familyId: "prioritization",
    method: "ICE",
    blurb: "Impact, Confidence, Ease — fast triage when reach is unknown.",
    evidenceNeeded: "Directional judgement; suitable when reach data is absent.",
  },
  {
    id: "wsjf",
    name: "WSJF",
    familyId: "prioritization",
    method: "Weighted Shortest Job First",
    blurb: "Cost of delay over job size — for sequencing under a fixed capacity.",
    evidenceNeeded: "A sense of time-criticality and relative size.",
    ask: 'Sections: "Cost of delay components" as a table ["Item","User/business value","Time criticality","Risk reduction / opportunity enablement","Cost of Delay","Job size","WSJF"] ordered by WSJF; "Sequence"; "What changes if capacity changes"; "Where the size estimates are guesses".',
  },
  {
    id: "kano",
    name: "Kano",
    familyId: "prioritization",
    method: "Kano classification",
    blurb: "Basic, performance or delighter — and what each earns you.",
    evidenceNeeded: "User reaction data, ideally paired functional/dysfunctional responses.",
    ask: 'Sections: "Classification" as a table ["Feature","Kano category","Why classified this way","Evidence","Investment implication"]; "Must-haves we are missing" (these buy nothing but their absence kills); "Delighters worth one bet"; "Performance features where more is genuinely better"; "Where classification is assumed rather than tested".',
  },
  {
    id: "moscow",
    name: "MoSCoW",
    familyId: "prioritization",
    method: "MoSCoW",
    blurb: "Must / Should / Could / Won't — scope discipline for a fixed release.",
    evidenceNeeded: "A defined release scope and a deadline.",
  },
  {
    id: "impact_effort",
    name: "Impact × Effort",
    familyId: "prioritization",
    method: "Impact-effort matrix",
    blurb: "The fastest honest triage when evidence is thin.",
    evidenceNeeded: "Directional judgement only — appropriate early.",
  },
  {
    id: "cost_of_delay",
    name: "Cost of Delay",
    familyId: "prioritization",
    method: "Cost of delay",
    blurb: "What waiting actually costs, item by item.",
    evidenceNeeded: "Value-over-time signal for each item.",
  },

  /* -------------------------- Business & Financial ---------------------- */
  {
    id: "roi",
    name: "ROI / Payback",
    familyId: "business",
    method: "ROI + payback period",
    blurb: "Return against cost, with every assumption on the surface.",
    evidenceNeeded: "A cost estimate and a defensible benefit driver.",
    ask: 'Sections: "Assumptions" as a table ["Assumption","Value used","Basis","Confidence"] — every input listed; "Model" as a table ["Line","Year 1","Year 2","Year 3"] covering benefit, cost and net; "Payback period"; "Sensitivity" (which assumption breaks the case and at what value); "What we would need to measure to firm this up". Never present a modelled number as a forecast.',
  },
  {
    id: "unit_economics",
    name: "Unit Economics",
    familyId: "business",
    method: "Per-unit contribution",
    blurb: "Whether one unit of this makes or loses money.",
    evidenceNeeded: "Cost-to-serve and revenue-per-unit inputs.",
  },
  {
    id: "revenue_impact",
    name: "Revenue Impact",
    familyId: "business",
    method: "Revenue bridge",
    blurb: "How this moves revenue, through which mechanism.",
    evidenceNeeded: "A revenue baseline and a plausible mechanism.",
  },
  {
    id: "cost_reduction",
    name: "Cost Reduction",
    familyId: "business",
    method: "Cost-to-serve analysis",
    blurb: "What work disappears, and whether the cost really leaves.",
    evidenceNeeded: "Current cost-to-serve or effort data.",
  },
  {
    id: "sensitivity",
    name: "Sensitivity Analysis",
    familyId: "business",
    method: "Sensitivity / tornado",
    blurb: "Which assumption the whole case actually rests on.",
    evidenceNeeded: "An existing model with named assumptions.",
  },

  /* ---------------------------- Experimentation ------------------------- */
  {
    id: "hypothesis",
    name: "Hypothesis Analysis",
    familyId: "experimentation",
    method: "Falsifiable hypothesis set",
    blurb: "State beliefs so they can be proven wrong, and rank them by risk.",
    evidenceNeeded: "A proposed solution or belief set.",
    ask: 'Sections: "Hypotheses" as a table ["Hypothesis (we believe… we will know we are right when…)","Type (desirability / viability / feasibility / usability)","If wrong, what breaks","Confidence","Cheapest test"] ordered by risk; "The riskiest assumption" (the one that, if false, invalidates the rest); "Test sequence".',
  },
  {
    id: "experiment_design",
    name: "Experiment Design",
    familyId: "experimentation",
    method: "Experiment design",
    blurb: "The cheapest test that could actually change the decision.",
    evidenceNeeded: "A specific hypothesis and access to a population.",
  },
  {
    id: "ab_analysis",
    name: "A/B Test Analysis",
    familyId: "experimentation",
    method: "Experiment readout",
    blurb: "What a result does and does not license you to conclude.",
    evidenceNeeded: "Actual experiment results with sample sizes.",
  },

  /* ---------------------------------- Risk ------------------------------ */
  {
    id: "product_risk",
    name: "Product Risk",
    familyId: "risk",
    method: "Risk register",
    blurb: "Desirability, viability, feasibility and usability risk in one view.",
    evidenceNeeded: "A defined solution direction.",
  },
  {
    id: "adoption_risk",
    name: "Adoption Risk",
    familyId: "risk",
    method: "Adoption barrier analysis",
    blurb: "What stops people using it even if you build it well.",
    evidenceNeeded: "User context and any prior adoption experience.",
  },
  {
    id: "delivery_risk",
    name: "Delivery Risk",
    familyId: "risk",
    method: "Delivery risk register",
    blurb: "What makes the plan late, and what you'd see first.",
    evidenceNeeded: "A scope and a rough plan.",
  },
  {
    id: "regulatory_risk",
    name: "Regulatory Risk",
    familyId: "risk",
    method: "Compliance risk register",
    blurb: "Where a rule could stop or reshape the work.",
    evidenceNeeded: "Domain and regulatory research.",
  },

  /* -------------------------------- Delivery ---------------------------- */
  {
    id: "dependency",
    name: "Dependency Analysis",
    familyId: "delivery",
    method: "Dependency map",
    blurb: "What must land before what, and who owns each link.",
    evidenceNeeded: "A scope broken into items.",
  },
  {
    id: "sequencing",
    name: "Sequencing & Critical Path",
    familyId: "delivery",
    method: "Critical path",
    blurb: "The order that gets to value soonest without breaking.",
    evidenceNeeded: "Items plus their dependencies.",
  },
  {
    id: "release_planning",
    name: "Release Planning",
    familyId: "delivery",
    method: "Release slicing",
    blurb: "Slices that each ship something a user can actually use.",
    evidenceNeeded: "A prioritised scope.",
  },

  /* ------------------------------- AI Product --------------------------- */
  {
    id: "ai_quality",
    name: "AI Quality & Trust",
    familyId: "ai",
    method: "AI evaluation framework",
    blurb: "Accuracy, grounding, hallucination, escalation, latency, cost.",
    evidenceNeeded: "A defined AI task and its acceptable failure mode.",
  },
  {
    id: "ai_hitl",
    name: "Human-in-the-Loop Design",
    familyId: "ai",
    method: "HITL design analysis",
    blurb: "Where a human must stay in the loop, and what they see.",
    evidenceNeeded: "The AI task plus the cost of an error.",
    ask: 'Sections: "Error cost analysis" as a table ["AI decision","What a wrong answer costs","Who bears it","Reversible?","Required human checkpoint"]; "Where autonomy is safe and where it is not"; "What the human needs to see to judge quickly" (a reviewer who cannot verify in seconds will rubber-stamp); "Escalation design"; "How we measure whether the loop is working".',
  },
  {
    id: "ai_economics",
    name: "AI Cost & Latency",
    familyId: "ai",
    method: "Inference economics",
    blurb: "What each interaction costs and whether it feels fast enough.",
    evidenceNeeded: "Expected interaction volume and model choice.",
  },

  /* ---------------------------- Scenario & Foresight -------------------- */
  {
    id: "scenarios",
    name: "Best / Base / Worst",
    familyId: "foresight",
    method: "Scenario analysis",
    blurb: "How the decision holds up across three futures.",
    evidenceNeeded: "A decision plus its key uncertainties.",
  },
  {
    id: "future_scenarios",
    name: "Future Scenarios",
    familyId: "foresight",
    method: "Scenario planning",
    blurb: "Distinct worlds this could play out in, and the signals for each.",
    evidenceNeeded: "Trend and foresight research.",
  },
];

export function getMethod(id: string): AnalysisMethod | undefined {
  return ANALYSIS_METHODS.find((m) => m.id === id);
}
export function getFamily(id: string): MethodFamily | undefined {
  return METHOD_FAMILIES.find((f) => f.id === id);
}
/** The section spec for a method — its own, or its family's default. */
export function methodAsk(m: AnalysisMethod): string {
  return m.ask ?? getFamily(m.familyId)?.defaultAsk ?? "";
}
