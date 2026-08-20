/**
 * Product-agent catalog — pure data, safe to import from client components.
 * (The runner in agents.ts pulls in server-only deps; keep metadata here.)
 */
export interface ProductAgentMeta {
  id: string;
  promptId: string;
  name: string;
  blurb: string;
  icon: string;
  category: "Market" | "Product" | "Delivery" | "Compliance";
  future?: string;
}

export const PRODUCT_AGENTS: ProductAgentMeta[] = [
  { id: "market", promptId: "pa_market", name: "Market Analysis", icon: "🌐", category: "Market",
    blurb: "Market trends and shifts that create backlog-worthy opportunities.",
    future: "Live web retrieval with cited sources." },
  { id: "competitive", promptId: "pa_competitive", name: "Competitive Intel", icon: "📈", category: "Market",
    blurb: "What competitors ship and where you can differentiate.",
    future: "Auto-track competitor release notes & analyst coverage." },
  { id: "feedback", promptId: "pa_feedback", name: "Voice of Customer", icon: "💬", category: "Product",
    blurb: "Themes and pain points from users of this kind of product.",
    future: "Ingest real reviews, tickets, and survey verbatims." },
  { id: "defects", promptId: "pa_defects", name: "Defect & Reliability", icon: "🐞", category: "Delivery",
    blurb: "Likely production defects and reliability risks to fix.",
    future: "Connect to telemetry/error tracking for real, live defects." },
  { id: "process", promptId: "pa_process", name: "Process Analysis", icon: "⚙️", category: "Delivery",
    blurb: "Operational friction and automation opportunities.",
    future: "Ingest SOPs and process-mining exports." },
  { id: "regulatory", promptId: "pa_regulatory", name: "Regulatory & Compliance", icon: "⚖️", category: "Compliance",
    blurb: "Regulations and compliance changes affecting this product.",
    future: "Subscribe to live regulatory feeds for the product's domain." },
  { id: "knowledge", promptId: "pa_knowledge", name: "Knowledge Preservation", icon: "🧠", category: "Delivery",
    blurb: "Captures what the product/code does and flags drift & risk.",
    future: "Connect to the codebase to continuously analyze what it does." },
];

export function getProductAgent(id: string): ProductAgentMeta | undefined {
  return PRODUCT_AGENTS.find((a) => a.id === id);
}
