import type { CapabilityMeta } from "./types";

/**
 * The catalog of capabilities a user can pick. Grouped by category in the UI.
 * Adding a capability = add an entry here + a prompt/seed in run.ts + seeds.ts.
 */
export const CAPABILITIES: CapabilityMeta[] = [
  // --- Documents ---
  {
    id: "prd",
    name: "PRD",
    blurb: "Turn the input into a structured product requirements document.",
    category: "Document",
    icon: "📄",
  },
  {
    id: "requirements",
    name: "Detailed Requirements",
    blurb: "User stories with acceptance criteria, ready for the backlog.",
    category: "Document",
    icon: "✅",
  },

  // --- Research (agents that fetch) ---
  {
    id: "market",
    name: "Market Research",
    blurb: "Landscape, trends, and where this fits the market for this feature.",
    category: "Research",
    icon: "🌐",
    future: "Live web retrieval — an agent that fetches and cites current sources.",
  },
  {
    id: "competitive",
    name: "Competitive Analysis",
    blurb: "Who does this today and how — strengths, gaps, differentiation.",
    category: "Research",
    icon: "📈",
    future: "Auto-pull competitor product pages, release notes, and analyst notes.",
  },
  {
    id: "feedback",
    name: "Feedback Analysis",
    blurb: "What users say about this kind of feature — themes and sentiment.",
    category: "Research",
    icon: "💬",
    future: "Ingest real reviews, support tickets, and survey verbatims.",
  },

  // --- Analysis ---
  {
    id: "process",
    name: "Process & Domain Analysis",
    blurb: "How this touches real workflows, systems, and domain constraints.",
    category: "Analysis",
    icon: "⚙️",
  },
  {
    id: "defects",
    name: "Defect Foresight",
    blurb: "Common defects and failure modes to anticipate for this feature.",
    category: "Analysis",
    icon: "🐞",
    future: "Connect to the production platform to detect real, live defects.",
  },

  // --- Business Value ---
  {
    id: "value_quant",
    name: "Business Value — Quantifiable",
    blurb: "Tangible value: metrics, drivers, and an estimation template.",
    category: "Value",
    icon: "📊",
  },
  {
    id: "value_qual",
    name: "Business Value — Qualitative",
    blurb: "Strategic and experiential value that's real but hard to number.",
    category: "Value",
    icon: "✨",
  },
];

export function getCapability(id: string): CapabilityMeta | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

export const CATEGORY_ORDER: CapabilityMeta["category"][] = [
  "Document",
  "Research",
  "Analysis",
  "Value",
];
