/**
 * Domain model for a PAYER organization's MEMBER value chain.
 *
 * This is the "ground truth" that grounds every agent. The Domain Context Agent
 * reads and extends it; the Defect, Market, and Process agents map their signals
 * back onto these stages so that everything a payer discovers is anchored to a
 * shared spine.
 *
 * The model is intentionally payer-specific (health insurance) rather than
 * generic. It captures the stages a member moves through, who is involved, how
 * success is measured, and which regulations constrain the work.
 */

export type ValueChainId = "member";

export interface Persona {
  id: string;
  name: string;
  role: "member" | "caregiver" | "internal" | "provider" | "regulator";
  description: string;
}

export interface Kpi {
  id: string;
  name: string;
  unit: string;
  /** Directionality of "good": higher or lower. */
  betterWhen: "higher" | "lower";
  benchmark?: string;
}

export interface ValueChainStage {
  id: string;
  order: number;
  name: string;
  /** One-line description of what happens for the member in this stage. */
  summary: string;
  /** The jobs the member is trying to get done in this stage. */
  memberJobs: string[];
  /** Systems / applications that typically serve this stage. */
  systems: string[];
  /** KPI ids most relevant to this stage. */
  kpis: string[];
  /** Common, well-documented pain points — used to seed agents in demo mode. */
  knownFriction: string[];
}

export interface ValueChain {
  id: ValueChainId;
  name: string;
  description: string;
  stages: ValueChainStage[];
}

export const PERSONAS: Persona[] = [
  {
    id: "member",
    name: "Member",
    role: "member",
    description:
      "The insured individual. Wants to understand coverage, get care, and resolve issues with minimal friction.",
  },
  {
    id: "caregiver",
    name: "Caregiver / Authorized Rep",
    role: "caregiver",
    description:
      "A family member or authorized representative acting on behalf of the member (elderly parents, dependents).",
  },
  {
    id: "csr",
    name: "Member Services Rep",
    role: "internal",
    description:
      "Contact-center agent resolving member inquiries across enrollment, benefits, claims, and grievances.",
  },
  {
    id: "care-manager",
    name: "Care / Utilization Manager",
    role: "internal",
    description:
      "Clinician or nurse coordinating care, prior authorizations, and utilization review for members.",
  },
  {
    id: "provider",
    name: "Provider Office",
    role: "provider",
    description:
      "Clinic/hospital staff verifying eligibility, submitting claims, and requesting authorizations.",
  },
  {
    id: "regulator",
    name: "Regulator (CMS / State DOI)",
    role: "regulator",
    description:
      "Sets and enforces rules on marketing, enrollment, appeals timelines, and member communications.",
  },
];

export const KPIS: Kpi[] = [
  { id: "nps", name: "Member NPS", unit: "score", betterWhen: "higher", benchmark: "Health plan avg ~30" },
  { id: "fcr", name: "First-Contact Resolution", unit: "%", betterWhen: "higher", benchmark: "Best-in-class ~80%" },
  { id: "aht", name: "Average Handle Time", unit: "min", betterWhen: "lower", benchmark: "~6-8 min" },
  { id: "enroll-cycle", name: "Enrollment Cycle Time", unit: "days", betterWhen: "lower" },
  { id: "digital-adoption", name: "Digital Self-Service Adoption", unit: "%", betterWhen: "higher" },
  { id: "call-deflection", name: "Call Deflection Rate", unit: "%", betterWhen: "higher" },
  { id: "grievance-rate", name: "Grievance & Appeal Rate", unit: "per 1k members", betterWhen: "lower" },
  { id: "star-rating", name: "CMS Star Rating", unit: "stars", betterWhen: "higher", benchmark: "4+ stars = bonus" },
  { id: "retention", name: "Member Retention", unit: "%", betterWhen: "higher" },
  { id: "csat", name: "Member CSAT", unit: "%", betterWhen: "higher" },
];

export const MEMBER_VALUE_CHAIN: ValueChain = {
  id: "member",
  name: "Member Value Chain",
  description:
    "The end-to-end journey a health-plan member moves through, from shopping for a plan to renewing or leaving it. Discovery agents anchor every signal to one of these stages.",
  stages: [
    {
      id: "shop-quote",
      order: 1,
      name: "Shop & Quote",
      summary: "Prospect compares plans and gets a quote.",
      memberJobs: ["Compare plans and networks", "Estimate total cost of coverage", "Check if my doctor/drug is covered"],
      systems: ["Public shopping site", "Plan finder", "Provider & drug lookup"],
      kpis: ["digital-adoption", "csat"],
      knownFriction: [
        "Provider directory inaccurate at point of shopping",
        "Total cost of care is hard to estimate before enrolling",
        "Plan comparison overwhelms with jargon",
      ],
    },
    {
      id: "enroll-eligibility",
      order: 2,
      name: "Enrollment & Eligibility",
      summary: "Member applies, is verified, and coverage is activated.",
      memberJobs: ["Apply for coverage", "Verify eligibility", "Understand effective dates"],
      systems: ["Enrollment portal", "Eligibility engine", "Broker/employer feed"],
      kpis: ["enroll-cycle", "fcr"],
      knownFriction: [
        "Eligibility file errors delay activation",
        "Effective date confusion drives inbound calls",
        "834 enrollment mismatches with employer feeds",
      ],
    },
    {
      id: "onboarding",
      order: 3,
      name: "Onboarding & ID Cards",
      summary: "New member is welcomed and receives ID cards and benefit info.",
      memberJobs: ["Get my ID card", "Register for the portal/app", "Learn how to use my plan"],
      systems: ["Member portal", "Mobile app", "Digital ID card", "Welcome comms"],
      kpis: ["digital-adoption", "csat"],
      knownFriction: [
        "Digital ID card buried in app; members call for physical card",
        "Portal registration drop-off due to identity verification",
        "Welcome journey is generic, not benefit-aware",
      ],
    },
    {
      id: "benefits",
      order: 4,
      name: "Benefits & Coverage Understanding",
      summary: "Member figures out what is covered, what they owe, and where to go.",
      memberJobs: ["Know what's covered", "Understand deductible/copay", "Find in-network care"],
      systems: ["Benefits lookup", "Cost estimator", "Provider directory"],
      kpis: ["call-deflection", "csat"],
      knownFriction: [
        "Benefit language is contractual, not human-readable",
        "Cost estimator missing for common procedures",
        "Provider directory 'ghost networks' — listed doctors not accepting patients",
      ],
    },
    {
      id: "member-services",
      order: 5,
      name: "Member Services / Contact Center",
      summary: "Member gets help across channels for any question or issue.",
      memberJobs: ["Get a question answered fast", "Resolve an issue once", "Reach a human when needed"],
      systems: ["IVR", "Chatbot", "CRM / agent desktop", "Secure messaging"],
      kpis: ["fcr", "aht", "call-deflection", "nps"],
      knownFriction: [
        "Members repeat context across IVR, bot, and agent",
        "Agent desktop swivel-chairs across 5+ systems",
        "Chatbot deflects to phone for anything non-trivial",
      ],
    },
    {
      id: "claims-eob",
      order: 6,
      name: "Claims & EOB",
      summary: "Claims are adjudicated and the member understands what they owe.",
      memberJobs: ["Understand my EOB", "Know why a claim was denied", "Dispute an error"],
      systems: ["Claims platform", "EOB portal", "Payment/billing"],
      kpis: ["grievance-rate", "csat", "fcr"],
      knownFriction: [
        "EOBs are confusing — 'this is not a bill' still triggers calls",
        "Denial reasons are coded, not explained",
        "No clear next step when a claim is wrong",
      ],
    },
    {
      id: "care-um",
      order: 7,
      name: "Care & Utilization Management",
      summary: "Prior auth, care coordination, and utilization review for the member.",
      memberJobs: ["Get care approved quickly", "Coordinate care across providers", "Understand next steps"],
      systems: ["Prior-auth portal", "Care management platform", "Provider portal"],
      kpis: ["star-rating", "grievance-rate"],
      knownFriction: [
        "Prior auth turnaround is slow and opaque to the member",
        "Members unaware of care management programs they qualify for",
        "Fax-based auth workflows with providers",
      ],
    },
    {
      id: "pharmacy",
      order: 8,
      name: "Pharmacy / Rx",
      summary: "Member fills prescriptions and manages formulary/coverage.",
      memberJobs: ["Fill my prescription affordably", "Know if a drug is covered", "Handle prior auth for meds"],
      systems: ["PBM portal", "Formulary lookup", "Mail-order pharmacy"],
      kpis: ["csat", "star-rating"],
      knownFriction: [
        "Formulary changes surprise members at the counter",
        "Step therapy and PA cause abandonment at pharmacy",
        "Price differences (mail vs retail) not surfaced proactively",
      ],
    },
    {
      id: "grievances-appeals",
      order: 9,
      name: "Grievances & Appeals",
      summary: "Member formally disputes a decision; payer must respond in regulated timelines.",
      memberJobs: ["File a complaint or appeal", "Track its status", "Get a fair, timely resolution"],
      systems: ["G&A case system", "Correspondence engine", "Compliance tracking"],
      kpis: ["grievance-rate", "star-rating", "csat"],
      knownFriction: [
        "Appeal filing is paper/phone heavy",
        "No status transparency for the member",
        "Regulated timelines create compliance risk if missed",
      ],
    },
    {
      id: "renewal-retention",
      order: 10,
      name: "Renewal, Retention & Disenrollment",
      summary: "Member renews, is retained, or leaves the plan.",
      memberJobs: ["Decide whether to renew", "Understand plan changes", "Leave with minimal friction if needed"],
      systems: ["Renewal comms", "Retention campaigns", "Disenrollment workflow"],
      kpis: ["retention", "nps", "star-rating"],
      knownFriction: [
        "Annual notice of change (ANOC) is dense and ignored",
        "Voluntary disenrollment reasons not systematically captured",
        "Retention outreach is generic, not risk-based",
      ],
    },
  ],
};

export const VALUE_CHAINS: ValueChain[] = [MEMBER_VALUE_CHAIN];

export function getStage(id: string): ValueChainStage | undefined {
  return MEMBER_VALUE_CHAIN.stages.find((s) => s.id === id);
}

export function getKpi(id: string): Kpi | undefined {
  return KPIS.find((k) => k.id === id);
}
