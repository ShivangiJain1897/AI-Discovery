import type { CapabilityOutput } from "./types";

/**
 * Demo-mode seed outputs. Hand-authored templates that plug the user's real
 * input into {{INPUT}} / {{LABEL}} placeholders, so the experience is fully
 * usable with no API key. In live mode these are replaced by real Claude output.
 */
export const CAP_SEEDS: Record<string, CapabilityOutput> = {
  prd: {
    capabilityId: "prd",
    title: "PRD — {{LABEL}}",
    summary: "A structured PRD scaffolded from your input, ready to refine with your team.",
    sections: [
      {
        heading: "Problem & Context",
        body: "Derived from your input:\n“{{INPUT}}”\n\nFrame the underlying member/user problem, why it matters now, and the cost of not solving it.",
      },
      {
        heading: "Goals & Non-Goals",
        bullets: [
          "Goal: deliver the core outcome the input describes",
          "Goal: measurable improvement to the target member journey",
          "Non-goal: adjacent scope that should be a fast-follow",
        ],
      },
      {
        heading: "Target Users & Personas",
        bullets: ["Primary: the member/user in the input", "Secondary: internal staff supporting the flow"],
      },
      {
        heading: "Requirements",
        bullets: [
          "Functional requirement covering the primary happy path",
          "State/error handling for the key failure cases",
          "Accessibility, language-access, and compliance requirements",
        ],
      },
      {
        heading: "Success Metrics",
        bullets: ["Adoption of the new flow", "Reduction in avoidable contacts", "CSAT / task-completion rate"],
      },
      {
        heading: "Risks & Open Questions",
        bullets: ["Dependency and data-availability risks", "Open questions to resolve before build"],
      },
    ],
    tags: ["document", "prd"],
  },

  requirements: {
    capabilityId: "requirements",
    title: "Detailed Requirements — {{LABEL}}",
    summary: "User stories and testable acceptance criteria generated from your input.",
    sections: [
      { heading: "Summary", body: "Requirements derived from:\n“{{INPUT}}”" },
      {
        heading: "User Stories",
        bullets: [
          "As a member, I want the capability the input describes, so that I complete my task without help.",
          "As a support rep, I want visibility into the flow, so that I can assist when it fails.",
        ],
      },
      {
        heading: "Acceptance Criteria",
        bullets: [
          "Given a valid member, When they use the feature, Then the primary outcome succeeds.",
          "Given an error state, When it occurs, Then the member sees a clear next step.",
          "Given accessibility needs, When using assistive tech, Then the flow is fully operable.",
        ],
      },
      {
        heading: "Edge Cases & NFRs",
        bullets: ["Performance target for the primary action", "Security/PHI handling", "Offline/timeout behavior"],
      },
    ],
    tags: ["document", "requirements"],
  },

  market: {
    capabilityId: "market",
    title: "Market Research — {{LABEL}}",
    summary: "How your idea sits in its market and the trends shaping it.",
    sections: [
      { heading: "Market Context", body: "Positioning the capability from your input:\n“{{INPUT}}”" },
      {
        heading: "Key Trends",
        bullets: [
          "Consumer-grade expectations are reshaping this space",
          "AI-assisted, task-completing experiences are becoming table stakes",
          "Regulatory and transparency pressure is rising",
        ],
      },
      {
        heading: "Demand Signals",
        bullets: ["Rising search/interest for this capability", "Adjacent tools setting the expectation bar"],
      },
      { heading: "Where This Fits", body: "The idea addresses a real, current gap; sequence it against the trends above." },
      { heading: "Recommended Positioning", bullets: ["Lead with the outcome, not the feature", "Differentiate on trust and resolution"] },
    ],
    tags: ["research", "market"],
    note: "Advanced: a live web-retrieval agent will fetch and cite current sources here.",
  },

  competitive: {
    capabilityId: "competitive",
    title: "Competitive Analysis — {{LABEL}}",
    summary: "How others approach this and where you can differentiate.",
    sections: [
      { heading: "Competitive Landscape", body: "Comparing approaches to the capability in your input:\n“{{INPUT}}”" },
      {
        heading: "Comparison",
        table: {
          columns: ["Player", "Approach", "Strength", "Gap"],
          rows: [
            ["Incumbent A", "Established, feature-rich", "Trust & scale", "Dated UX, slow to change"],
            ["Challenger B", "Digital-first", "Modern experience", "Narrow coverage"],
            ["New entrant C", "AI-native", "Task completion", "Unproven, thin integrations"],
          ],
        },
      },
      { heading: "Differentiation Opportunities", bullets: ["Own the end-to-end resolution", "Win on transparency and speed"] },
      { heading: "Watch-outs", bullets: ["Fast-followers copying surface features", "Table-stakes gaps that erode trust"] },
    ],
    tags: ["research", "competitive"],
    note: "Advanced: auto-pull competitor product pages, release notes, and analyst coverage.",
  },

  feedback: {
    capabilityId: "feedback",
    title: "Feedback Analysis — {{LABEL}}",
    summary: "Themes and sentiment users typically express about this kind of feature.",
    sections: [
      { heading: "What Users Care About", bullets: ["Getting the task done without help", "Clarity and trust", "Speed and reliability"] },
      { heading: "Common Complaints", bullets: ["Confusing flows and jargon", "Dead-ends with no next step", "Having to repeat themselves"] },
      { heading: "Delight Drivers", bullets: ["Proactive, personalized guidance", "One-and-done resolution"] },
      { heading: "Sentiment Summary", body: "Sentiment for this class of feature is mixed-to-negative when it fails silently, strongly positive when it completes the task." },
    ],
    tags: ["research", "feedback"],
    note: "Advanced: ingest real reviews, support tickets, and survey verbatims for grounded sentiment.",
  },

  process: {
    capabilityId: "process",
    title: "Process & Domain Analysis — {{LABEL}}",
    summary: "How this touches real workflows, systems, roles, and domain constraints.",
    sections: [
      { heading: "Impacted Workflows", body: "For the capability in your input:\n“{{INPUT}}”", bullets: ["Primary member-facing flow", "Supporting back-office process"] },
      { heading: "Systems & Integrations", bullets: ["System of record for the data involved", "Downstream systems that must stay in sync"] },
      { heading: "Roles & Handoffs", bullets: ["Member/user", "Support or clinical staff", "Compliance/ops oversight"] },
      { heading: "Domain Constraints", bullets: ["Regulatory/compliance rules (e.g. HIPAA, CMS where applicable)", "Data privacy and consent"] },
      { heading: "Automation Opportunities", bullets: ["Eliminate a manual handoff", "Auto-resolve the common case"] },
    ],
    tags: ["analysis", "process"],
  },

  defects: {
    capabilityId: "defects",
    title: "Defect Foresight — {{LABEL}}",
    summary: "Common defects and failure modes to anticipate for this feature before it ships.",
    sections: [
      { heading: "Likely Defect Areas", body: "For the capability in your input:\n“{{INPUT}}”", bullets: ["Auth/eligibility edge cases", "Data freshness/caching", "Error and empty states", "Cross-platform (mobile/web) parity"] },
      {
        heading: "Failure Modes & Impact",
        table: {
          columns: ["Area", "Failure mode", "Member impact", "Severity"],
          rows: [
            ["Load/state", "Blank or spinning screen on first use", "Falls back to calling", "High"],
            ["Data sync", "Stale info shown after an update", "Wrong decision / distrust", "Critical"],
            ["Errors", "Coded error with no next step", "Dead-end, repeat contact", "Medium"],
          ],
        },
      },
      { heading: "Test Focus", bullets: ["Unhappy paths and timeouts", "Post-update cache invalidation", "Accessibility and localization"] },
      { heading: "Guardrails", bullets: ["Clear fallback for every error", "Telemetry on the key failure points"] },
    ],
    tags: ["analysis", "defects"],
    note: "Advanced: connect to the live production platform to replace anticipation with real, detected defects.",
  },

  value_quant: {
    capabilityId: "value_quant",
    title: "Business Value — Quantifiable — {{LABEL}}",
    summary: "A tangible value model with an estimation template. Numbers are illustrative placeholders — swap in your real baselines.",
    sections: [
      { heading: "Value Drivers", bullets: ["Deflected contacts", "Higher self-service completion", "Retention lift"] },
      {
        heading: "Quantified Impact",
        table: {
          columns: ["Metric", "Baseline", "Target", "Est. annual value", "How to measure"],
          rows: [
            ["Avoidable calls", "100k/yr", "-15%", "$X (calls × cost/call)", "Contact-driver analytics"],
            ["Self-service completion", "60%", "+10pp", "$Y (deflection value)", "Funnel completion rate"],
            ["Retention", "Baseline %", "+0.5pp", "$Z (LTV × members)", "Cohort retention"],
          ],
        },
      },
      { heading: "Assumptions", bullets: ["Cost-per-contact and LTV inputs", "Adoption ramp over 2-3 quarters"] },
      { heading: "How to Validate", bullets: ["Instrument before launch", "A/B or phased rollout", "Track against the baselines above"] },
    ],
    tags: ["value", "quantifiable"],
  },

  value_qual: {
    capabilityId: "value_qual",
    title: "Business Value — Qualitative — {{LABEL}}",
    summary: "Real but hard-to-number value: strategy, experience, and risk.",
    sections: [
      { heading: "Strategic Value", bullets: ["Moves toward a differentiated, resolution-first experience", "Builds a reusable capability, not a one-off"] },
      { heading: "Member/User Experience Value", bullets: ["Less effort and confusion", "More trust through transparency"] },
      { heading: "Risk & Compliance Value", bullets: ["Reduces compliance exposure on the flow", "Improves auditability"] },
      { heading: "Narrative", body: "This investment strengthens how members experience the plan at a key moment — reducing effort and building trust in ways that compound into loyalty, even where the dollar impact is hard to isolate up front." },
    ],
    tags: ["value", "qualitative"],
  },
};
