import type { GenerateJsonParams, LlmProvider } from "./provider";

/**
 * Deterministic demo provider. Returns realistic, payer-specific seed data so
 * the platform is fully usable without any API key. The data is hand-authored
 * to reflect genuine member value-chain problems, so demos land as real.
 *
 * Keyed by `mockKey`. Each agent passes its own key.
 */
export class MockProvider implements LlmProvider {
  readonly mode = "demo" as const;
  readonly label = "Demo mode (seed data)";

  async generateJson<T = unknown>(params: GenerateJsonParams): Promise<T> {
    // Small artificial latency so the UI shows the agents "working".
    await new Promise((r) => setTimeout(r, 250 + Math.floor(Math.random() * 400)));
    const key = params.mockKey ?? "";
    const data = SEED[key];
    if (!data) {
      throw new Error(`No demo seed for mockKey="${key}"`);
    }
    return data as T;
  }
}

const SEED: Record<string, unknown> = {
  "domain-brief": {
    summary:
      "The member value chain spans shopping through renewal. The highest-leverage moments today are Onboarding, Benefits Understanding, and the Contact Center — where confusion converts into avoidable calls, grievances, and churn. Members increasingly expect a consumer-grade digital experience while regulation constrains how the plan communicates.",
    personas: [
      { name: "Member", motivation: "Understand my coverage and resolve issues without repeating myself." },
      { name: "Caregiver", motivation: "Act on behalf of a parent or dependent across the plan." },
      { name: "Member Services Rep", motivation: "Resolve the member's issue in one contact without swivel-chairing." },
    ],
    priorityKpis: [
      { kpi: "First-Contact Resolution", why: "Directly reflects whether members get resolved without repeat effort." },
      { kpi: "Call Deflection Rate", why: "Confusion in onboarding/benefits drives avoidable inbound volume." },
      { kpi: "CMS Star Rating", why: "Grievances, appeals timeliness, and CAHPS survey experience feed Stars and bonus revenue." },
      { kpi: "Member Retention", why: "Onboarding and renewal experience predict voluntary disenrollment." },
    ],
    constraints: [
      "HIPAA governs any member PHI shown or transmitted.",
      "CMS marketing rules constrain plan comparison and outreach content.",
      "Appeals and grievance responses must meet regulated timelines.",
      "Member communications must meet readability and language-access requirements.",
    ],
    focusStages: ["onboarding", "benefits", "member-services", "claims-eob"],
  },

  "defect-signals": {
    signals: [
      {
        stageId: "onboarding",
        title: "Digital ID card fails to load on first app launch",
        detail:
          "New members frequently report a blank or spinning ID card screen on first login, forcing a call to request a physical card. Pattern spikes at start-of-year enrollment surge.",
        severity: "high",
        evidence: [
          "App store reviews: 'Can't see my ID card, had to call' (recurring, 1-2 star)",
          "Support ticket cluster: 'digital ID card blank' during Jan enrollment",
        ],
        confidence: 0.78,
        impactedKpis: ["digital-adoption", "call-deflection"],
      },
      {
        stageId: "member-services",
        title: "Chatbot loses context when handing off to a live agent",
        detail:
          "Members who escalate from chatbot to agent must re-state their entire issue; the transcript and identity are not passed through, inflating handle time and frustration.",
        severity: "high",
        evidence: [
          "CSAT verbatims: 'Had to explain everything again to the agent'",
          "Agent desktop lacks inbound chatbot transcript field",
        ],
        confidence: 0.72,
        impactedKpis: ["aht", "fcr", "nps"],
      },
      {
        stageId: "claims-eob",
        title: "EOB PDF download broken on mobile Safari",
        detail:
          "Members on iOS report the 'Download EOB' action produces a blank file or error, blocking them from saving/sharing claims documents.",
        severity: "medium",
        evidence: [
          "App store review pattern on iOS builds",
          "Reproduced: PDF endpoint returns wrong content-type on mobile Safari",
        ],
        confidence: 0.65,
        impactedKpis: ["csat"],
      },
      {
        stageId: "benefits",
        title: "Cost estimator returns 'no data' for common procedures",
        detail:
          "For frequently-searched procedures (MRI, colonoscopy), the estimator returns empty results, undermining trust and pushing members to call for cost info.",
        severity: "medium",
        evidence: [
          "Analytics: high search volume, high 'no results' rate on estimator",
          "Members call to ask 'how much will X cost'",
        ],
        confidence: 0.6,
        impactedKpis: ["call-deflection", "csat"],
      },
      {
        stageId: "pharmacy",
        title: "Formulary lookup shows stale coverage after plan-year change",
        detail:
          "After Jan 1 formulary updates, lookup continues to show prior-year coverage for some drugs, surprising members at the pharmacy counter.",
        severity: "critical",
        evidence: [
          "Complaint spike post plan-year change",
          "Formulary cache not invalidated on annual load",
        ],
        confidence: 0.7,
        impactedKpis: ["csat", "star-rating"],
      },
    ],
  },

  "market-signals": {
    signals: [
      {
        stageId: "member-services",
        title: "Leading plans deploy AI concierge that resolves, not just deflects",
        detail:
          "Competitors are shipping AI assistants that complete tasks (find a doctor, explain a claim, start an appeal) end-to-end, resetting member expectations from 'search' to 'get it done'.",
        severity: "high",
        evidence: [
          "Public product launches from national payers and healthtech entrants",
          "Member expectation benchmark: consumer apps set the bar for resolution",
        ],
        confidence: 0.68,
        impactedKpis: ["call-deflection", "nps", "fcr"],
      },
      {
        stageId: "benefits",
        title: "Price transparency raises the bar on cost estimation",
        detail:
          "Regulatory price transparency plus third-party tools mean members can compare real prices; plans without accurate, procedure-level estimates look behind.",
        severity: "medium",
        evidence: [
          "Transparency-in-coverage machine-readable files now public",
          "Third-party cost tools set member expectations",
        ],
        confidence: 0.62,
        impactedKpis: ["csat", "digital-adoption"],
      },
      {
        stageId: "onboarding",
        title: "Benefit-aware digital onboarding is becoming table stakes",
        detail:
          "Best-in-class onboarding tailors the welcome journey to the member's actual plan and likely needs (chronic condition, new-to-Medicare), lifting activation and retention.",
        severity: "medium",
        evidence: [
          "Competitor onboarding flows personalize by plan and cohort",
          "Activation correlates with first-90-day retention",
        ],
        confidence: 0.6,
        impactedKpis: ["retention", "digital-adoption"],
      },
      {
        stageId: "grievances-appeals",
        title: "Members expect status transparency for appeals",
        detail:
          "Consumers expect package-tracking-style visibility; opaque appeals processes generate repeat calls and erode trust, and directly affect Stars.",
        severity: "medium",
        evidence: [
          "Consumer benchmark: real-time status is expected",
          "Appeals timeliness is a Star measure",
        ],
        confidence: 0.58,
        impactedKpis: ["star-rating", "grievance-rate"],
      },
    ],
  },

  "process-signals": {
    signals: [
      {
        stageId: "member-services",
        title: "Agents swivel-chair across 5+ systems per contact",
        detail:
          "The agent desktop requires manually navigating enrollment, claims, benefits, and G&A systems to resolve a single member issue, inflating handle time and error rate.",
        severity: "high",
        evidence: [
          "Process map: 5-7 system touches for a benefits+claims inquiry",
          "Agent time-in-app telemetry shows heavy context switching",
        ],
        confidence: 0.75,
        impactedKpis: ["aht", "fcr"],
      },
      {
        stageId: "care-um",
        title: "Prior authorization still runs on fax and manual review",
        detail:
          "Auth requests arrive by fax and are keyed manually, creating slow, opaque turnaround the member can't see and the provider chases by phone.",
        severity: "high",
        evidence: [
          "SOP shows fax intake + manual nurse review queue",
          "Turnaround time variance is high; member has no visibility",
        ],
        confidence: 0.7,
        impactedKpis: ["star-rating", "grievance-rate"],
      },
      {
        stageId: "enroll-eligibility",
        title: "Eligibility file errors surface late as member-facing failures",
        detail:
          "834 mismatches with employer/CMS feeds are caught downstream, so members hit coverage-not-active errors at point of care instead of being fixed proactively.",
        severity: "medium",
        evidence: [
          "Reconciliation runs after activation, not before",
          "Inbound 'my coverage isn't active' call driver",
        ],
        confidence: 0.66,
        impactedKpis: ["enroll-cycle", "fcr"],
      },
      {
        stageId: "grievances-appeals",
        title: "Appeals intake is paper/phone-heavy with manual timeline tracking",
        detail:
          "Grievance and appeal cases are opened from calls and paper forms, with compliance timelines tracked manually — a resolution-speed and regulatory-risk bottleneck.",
        severity: "medium",
        evidence: [
          "Case system fed manually from call notes and mailed forms",
          "Timeline compliance tracked in spreadsheets",
        ],
        confidence: 0.63,
        impactedKpis: ["grievance-rate", "star-rating"],
      },
    ],
  },
};

/**
 * Synthesis is generated deterministically from whatever signals were collected,
 * so the mock does not need a static opportunity list. See orchestrator's
 * heuristic synthesizer, which is used when the provider is in demo mode.
 */
