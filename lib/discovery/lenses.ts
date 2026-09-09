/**
 * The research lenses.
 *
 * Six, not eleven. Four run by default — the ones that matter for almost any
 * product or feature idea. Compliance and feasibility are opt-in because they
 * only earn their place in regulated or technically-risky work.
 *
 * To change how a lens thinks, edit its `system`. To add one, add an entry here
 * and an id to `LensId` — the API and the UI read this list.
 */
import type { LensId } from "./types";

export interface Lens {
  id: LensId;
  name: string;
  icon: string;
  /** One line, shown next to the checkbox. */
  blurb: string;
  /** On by default? */
  standard: boolean;
  /** Does live web research before answering. */
  web?: boolean;
  system: string;
  /** Illustrative findings for demo mode — never shown without a demo label. */
  demo: { title: string; detail: string }[];
}

const SHARED = `Rules that matter more than anything else you do:
- Never invent numbers, quotes, competitor features, prices or metrics. If you don't know, say what would tell us.
- Say what a finding rests on. "Users say X" and "analytics show X" are different things.
- Be specific to THIS idea. If a sentence would survive swapping in a different product's name, delete it.
- Don't just agree with the idea. If the evidence points against it, say so plainly.`;

export const LENSES: Lens[] = [
  {
    id: "user_research",
    name: "User research",
    icon: "🗣️",
    blurb: "Who it's for, what they're trying to do, and where it hurts today.",
    standard: true,
    system: `You are a user researcher. Work out who this is for and what they actually need.

Cover: the main user types, the job they're trying to get done, their biggest pains, how they cope today, and what would stop them adopting this.

${SHARED}
- Name the user type and the moment in their day. "Users want efficiency" is not a finding.
- Separate what users SAY from what they DO. Don't treat a stated preference as proof.`,
    demo: [
      { title: "The main user is time-poor, not feature-poor", detail: "Most people in this position are trying to finish one task quickly; extra capability that adds steps tends to go unused." },
      { title: "There's likely a second user acting on someone's behalf", detail: "Admins, caregivers or delegates often do this work for someone else, and flows built for a single user break for them." },
      { title: "Today the gap gets filled manually", detail: "Where a product doesn't cover a need, people fall back to spreadsheets, email and phone calls — that workaround is the real competitor." },
    ],
  },
  {
    id: "market",
    name: "Market & competitive",
    icon: "🌐",
    blurb: "The market, who else solves this, and what's changing.",
    standard: true,
    web: true,
    system: `You are a market and competitive analyst. Work out what the market looks like and who else solves this.

Cover: the category and roughly how it's growing, the direct competitors, the indirect ones, and the non-product alternatives (doing it manually, doing nothing). For each, why a customer would choose it. Then: what's becoming table stakes, and where the genuine opening is.

${SHARED}
- Name real companies and products only where your research supports it. Otherwise describe the type and mark it unverified.
- Every number needs a source and a date, or it doesn't go in.
- Always include the manual workaround and "do nothing" as competitors. They win more often than any vendor.`,
    demo: [
      { title: "The category is crowded at the low end, thin at the workflow end", detail: "Point tools that do one step are common; products that carry the whole job end-to-end are rarer and harder to displace." },
      { title: "The real competitor is the spreadsheet", detail: "In most categories like this, the alternative isn't a rival product — it's the manual process people already trust." },
      { title: "Expectations have moved to resolution, not search", detail: "Users increasingly expect a product to complete the task rather than point them at where to do it themselves." },
    ],
  },
  {
    id: "bugs",
    name: "Bugs & support",
    icon: "🐞",
    blurb: "What breaks today, and what people keep contacting you about.",
    standard: true,
    system: `You are a product quality analyst. Work out what's failing and what it's costing.

Cover: the failure modes this kind of product predictably has, what drives support contacts, and where friction repeats.

${SHARED}
- Group issues into clusters with a shared cause. A list of individual bugs is not analysis.
- For each cluster, say which it is: a real defect, a usability problem, a missing capability, or a process problem. They need completely different fixes, and calling a usability problem a bug sends the team the wrong way.
- Rank by how many people hit it and how badly, not by how loud the complaint was.`,
    demo: [
      { title: "First-run failures cost the most", detail: "Errors during setup or first use convert directly into support contacts and abandonment, because the user has no context to recover from them." },
      { title: "Most 'bugs' here are usually usability problems", detail: "In flows like this, a large share of reported issues are people doing the right thing in a way the product didn't anticipate." },
      { title: "Errors without a next step dead-end the user", detail: "A message that states a problem but not a recovery path reliably becomes a phone call." },
    ],
  },
  {
    id: "process",
    name: "Process mining",
    icon: "🔄",
    blurb: "How the work gets done today, and where it stalls.",
    standard: true,
    system: `You are a process analyst. Map how this work actually gets done today.

Cover: the steps in order, who does each one, which systems they touch, where the handoffs are, where the waiting is, and what gets redone.

${SHARED}
- Write the current process as an ordered list of steps with an actor for each. A description without steps isn't process analysis.
- Say clearly whether the fix is a PRODUCT change or a PROCESS change. Building software at a process problem is the most expensive way to fail.
- Name the one bottleneck that, if removed, moves the outcome most.`,
    demo: [
      { title: "The handoff is where time goes, not the work", detail: "In processes like this, most elapsed time is spent waiting between steps rather than doing them." },
      { title: "People swivel between systems to finish one task", detail: "Where data lives in several places, staff copy between them by hand — slow, and a reliable source of errors." },
      { title: "Errors are caught late, not at entry", detail: "Problems found downstream cost far more to fix than the same problem caught at the point of entry." },
    ],
  },
  {
    id: "compliance",
    name: "Compliance & risk",
    icon: "⚖️",
    blurb: "Rules and constraints that shape what you can build.",
    standard: false,
    web: true,
    system: `You are a compliance analyst. Work out what rules and constraints apply.

Cover: the specific regulations and standards that bear on this, plus privacy, security and accessibility obligations.

${SHARED}
- Name the actual regulation and jurisdiction. "Ensure compliance" is noise; "HIPAA audit-logging requirements for PHI shown in-app" is a finding.
- Say what each constraint FORBIDS, REQUIRES or DELAYS in product terms. If it has no product consequence, leave it out.
- Never state a legal conclusion. Flag what needs legal or compliance sign-off.`,
    demo: [
      { title: "Personal data pulls in consent and retention duties", detail: "Handling identifiable data invokes obligations around consent, retention limits, access controls and audit trails." },
      { title: "Accessibility is a build requirement, not a polish item", detail: "Retrofitting accessibility after the fact is far more expensive than designing for it from the start." },
      { title: "Anything user-facing may need review before launch", detail: "In regulated settings, customer-facing content and communications often need sign-off, which belongs in the timeline." },
    ],
  },
  {
    id: "feasibility",
    name: "Feasibility",
    icon: "🛠️",
    blurb: "Can it be built — data, integrations, effort, and AI risk.",
    standard: false,
    system: `You are a principal engineer assessing feasibility.

Cover: whether the data needed exists and is accessible, what has to be integrated, the main technical risks, and roughly how big this is (a spike, a sprint, a quarter, a platform bet).

If the idea involves AI, also cover: whether answers can be grounded in real data, what a wrong answer costs, whether a human needs to stay in the loop, and roughly what each interaction costs to run.

${SHARED}
- Lead with the data question: does the data required to make this work exist, and can we get at it? Most ideas die here, not in the code.
- Give size as a shape with a reason, never a made-up estimate in weeks or points.
- Name the one technical risk most likely to sink this, and the cheapest way to test it early.`,
    demo: [
      { title: "The data question comes before the build question", detail: "Whether the required data exists, is accessible and is clean usually decides feasibility long before engineering effort does." },
      { title: "Integration surface drives the real cost", detail: "The number of systems that must be touched predicts effort better than the complexity of the feature itself." },
      { title: "If AI is involved, grounding is the hard part", detail: "Getting an AI feature to be reliably right on your own data — and handling the cases where it isn't — is where the work concentrates." },
    ],
  },
];

export function getLens(id: string): Lens | undefined {
  return LENSES.find((l) => l.id === id);
}
export function lensName(id: string): string {
  return getLens(id)?.name ?? id;
}
export const DEFAULT_LENSES: LensId[] = LENSES.filter((l) => l.standard).map((l) => l.id);
