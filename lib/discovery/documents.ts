/**
 * The documents you can get out.
 *
 * Four, because these are the four things a PM actually needs to hand someone.
 * All of them are written from the research already gathered — asking for a
 * second one never re-runs research.
 *
 * Each document's `outline` is structured data, not prose, so it drives both the
 * live prompt AND the demo-mode skeleton. That keeps the two in step: what you
 * see without an API key is the real shape of the document.
 */
import type { DocumentId, Kind } from "./types";

export interface DocumentDef {
  id: DocumentId;
  name: string;
  icon: string;
  /** One line, shown on the button. */
  blurb: string;
  /** The section headings, in order. Varies by product vs feature. */
  outline: (kind: Kind) => string[];
  /** How to write it well — appended to the prompt after the outline. */
  guidance: string;
}

export const DOCUMENTS: DocumentDef[] = [
  {
    id: "use_cases",
    name: "Use cases",
    icon: "📋",
    blurb: "Who does what, when, and what happens.",
    outline: () => ["What this is", "Users", "Use cases", "Out of scope", "Open questions"],
    guidance: `"Users" is a table ["User type","What they're trying to do","What's hard today"].
"Use cases" is a table ["#","Use case","Trigger","Steps","Outcome","Priority"] — steps as a short ordered sequence, not a paragraph.

Each use case must be something a real person does, with a trigger and an outcome. Don't pad the list — five real ones beat fifteen invented ones.`,
  },
  {
    id: "prd",
    name: "PRD",
    icon: "📄",
    blurb: "The spec a team could build from.",
    outline: (kind) =>
      kind === "product"
        ? [
            "Summary", "Problem", "Users", "Market & alternatives", "Goals & non-goals",
            "Scope — in and out", "Key capabilities", "Requirements",
            "Non-functional requirements", "Constraints & compliance", "Success metrics",
            "Risks & dependencies", "Rollout", "Open questions",
          ]
        : [
            "Summary", "Problem", "Users & use cases", "Goals & non-goals", "How it works",
            "Requirements", "Edge cases & error states", "Constraints & compliance",
            "Success metrics", "Risks & dependencies", "Open questions",
          ],
    guidance: `"Problem" carries a table ["What we believe","What it's based on","Confidence"].
"Users" (or "Users & use cases") carries a table ["User type","Job to be done","Key needs","Pains"].
"Market & alternatives", where present, is a table ["Alternative","Why people use it","Where it falls short"].
"Key capabilities", where present, is a table ["Capability","What it does","Why it matters","Priority"].
"How it works", where present, is the flow as ordered steps.
"Success metrics" is a table ["Metric","How we'd measure it","What good looks like"].

Requirements must be clear and testable. Drop "Constraints & compliance" entirely if the research surfaced nothing. For a feature, keep it to that one feature — don't let it sprawl into a product spec.`,
  },
  {
    id: "backlog",
    name: "Product backlog",
    icon: "🗂️",
    blurb: "Epics and stories, prioritised.",
    outline: () => ["How this is ordered", "Epics", "Stories", "Now / Next / Later", "Not doing yet"],
    guidance: `"How this is ordered" is two sentences on the reasoning. Be honest: with no usage data, say the priorities are relative judgement, not a calculation.
"Epics" is a table ["Epic","What it delivers","Why it matters","Priority"].
"Stories" is a table ["#","Epic","As a… I want… so that…","Acceptance criteria","Priority"] — acceptance criteria must be checkable, not aspirational.
"Now / Next / Later" is three short lists.

Every story must be independently valuable and small enough to build. Trace them to the research; don't invent scope the findings don't support.`,
  },
  {
    id: "business_case",
    name: "Business case",
    icon: "💷",
    blurb: "What it costs, what it returns, what's assumed.",
    outline: () => [
      "The ask", "Why now", "What we'd do", "Assumptions", "Where the value comes from",
      "Costs", "What would make this worth it", "Risks", "Recommendation",
    ],
    guidance: `"The ask" is one line.
"Assumptions" is a table ["Assumption","What we're assuming","How confident","How we'd check"] — EVERY input the case rests on goes here.
"Where the value comes from" is a table ["Value driver","How it creates value","How we'd measure it"].
"What would make this worth it" states the conditions under which the case holds, rather than inventing a return figure.
"Risks" is a table ["Risk","Impact","How we'd reduce it"].
"Recommendation" carries a confidence level and what would change it.

CRITICAL: do not invent financial figures, market sizes or ROI percentages. If we don't have the numbers, say what they'd need to be for this to be worth doing, and name what to go and measure. A business case built on invented numbers is worse than no business case.`,
  },
];

export function getDocument(id: string): DocumentDef | undefined {
  return DOCUMENTS.find((d) => d.id === id);
}

/** The full instruction for the live writer. */
export function documentSpec(def: DocumentDef, kind: Kind): string {
  const headings = def.outline(kind).map((h, i) => `${i + 1}. "${h}"`).join("\n");
  return `Write a ${def.name.toLowerCase()} document with these sections, in this order:

${headings}

${def.guidance}`;
}
