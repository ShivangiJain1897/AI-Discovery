/**
 * Product agents — the AI team a PM enables per product.
 *
 * Each agent reads the product brief and produces SIGNALS (findings). Live mode
 * uses Claude with an editable prompt (see Studio); demo mode uses a
 * deterministic generator seeded from the brief so it's fully usable with no key.
 *
 * Some agents describe a maturity path (e.g. Knowledge preservation connecting to
 * the codebase, Regulatory pulling live feeds). v1 reasons over the brief and
 * labels that upgrade in the UI.
 */
import { getProvider } from "../llm/provider";
import { getEffectivePrompt } from "../capabilities/prompt-store";
import { PRODUCT_AGENTS, getProductAgent } from "./catalog";
import type { Product, Severity, Signal } from "./types";

export { PRODUCT_AGENTS, getProductAgent };
export type { ProductAgentMeta } from "./catalog";

const SHAPE = `Return a JSON object: { "signals": [ { "title": string, "detail": string, "severity": "low"|"medium"|"high"|"critical", "evidence": string } ] }. Return 3-5 concrete, product-specific signals a PM could turn into backlog items.`;

export async function runInsightAgent(product: Product, agentId: string): Promise<Signal[]> {
  const meta = getProductAgent(agentId);
  if (!meta) throw new Error(`Unknown agent: ${agentId}`);
  const provider = await getProvider();

  if (provider.mode === "demo") {
    return demoSignals(product, agentId).map((s, i) => stamp(s, product.id, agentId, i));
  }

  const def = await getEffectivePrompt(meta.promptId);
  const b = product.brief;
  const prompt = `PRODUCT: ${product.name}
One-liner: ${product.oneLiner}
Overview: ${b.overview}
Target users: ${b.targetUsers}
Value prop: ${b.valueProp}
Platform: ${b.platform}
Market: ${b.market}
Regulatory context: ${b.regulatoryContext}
KPIs: ${(b.kpis || []).join(", ")}

${def.task}

${SHAPE}`;

  const raw = await provider.generateJson<{ signals: RawSignal[] }>({ system: def.system, prompt, maxTokens: 2000 });
  const signals = Array.isArray(raw?.signals) ? raw.signals : [];
  return signals.filter((s) => s && s.title).map((s, i) => stamp(s, product.id, agentId, i));
}

interface RawSignal { title: string; detail?: string; severity?: Severity; evidence?: string }

function stamp(s: RawSignal, productId: string, agentId: string, i: number): Signal {
  return {
    id: `${agentId}-${i + 1}`,
    productId,
    agentId,
    title: String(s.title).slice(0, 160),
    detail: String(s.detail ?? ""),
    severity: (["low", "medium", "high", "critical"] as const).includes(s.severity as Severity) ? (s.severity as Severity) : "medium",
    evidence: s.evidence ? String(s.evidence) : undefined,
    createdAt: Date.now(),
  };
}

/* ------------------------------- Demo signals ------------------------------- */

function demoSignals(p: Product, agentId: string): RawSignal[] {
  const name = p.name || "the product";
  const domain = `${p.oneLiner} ${p.brief.overview} ${p.brief.market}`.toLowerCase();
  const isHealth = /payer|member|health|insur|claim|medicare|patient/.test(domain);
  const table: Record<string, RawSignal[]> = {
    market: [
      { title: "AI concierge is becoming table stakes", detail: `Leading products in ${name}'s space ship assistants that complete tasks, not just search. Resetting user expectations.`, severity: "high", evidence: "Competitor launches; consumer-app benchmarks" },
      { title: "Rising demand for self-service", detail: "Users increasingly expect to resolve tasks without contacting support.", severity: "medium", evidence: "Category trend" },
      { title: "Transparency expectations increasing", detail: isHealth ? "Price/cost transparency pressure is rising for members." : "Users expect clearer status and pricing.", severity: "medium", evidence: "Regulatory + market signals" },
    ],
    competitive: [
      { title: "Challenger differentiates on onboarding", detail: `A digital-first competitor wins on a faster first-run experience than ${name}.`, severity: "high", evidence: "Competitor teardown" },
      { title: "Incumbents slow to modernize UX", detail: "Opportunity to win on a modern, resolution-first experience.", severity: "medium", evidence: "Market scan" },
    ],
    feedback: [
      { title: "Users get stuck at first-run setup", detail: `Common complaint: can't complete initial setup in ${name} without help.`, severity: "high", evidence: "Review/ticket theme" },
      { title: "Confusing status and next steps", detail: "Users report dead-ends with no clear next action.", severity: "medium", evidence: "Sentiment theme" },
      { title: "Delight when tasks complete end-to-end", detail: "Strong positive sentiment when a task is resolved in one go.", severity: "low", evidence: "Verbatim theme" },
    ],
    defects: [
      { title: "First-run screen intermittently blank", detail: `New users hit a blank/spinning screen on first open of ${name}; drives support contacts.`, severity: "high", evidence: "Error pattern (anticipated)" },
      { title: "Stale data after updates", detail: "Cached content shown after an update leads to wrong decisions.", severity: "critical", evidence: "Cache-invalidation risk" },
      { title: "Errors lack a next step", detail: "Coded errors dead-end the user.", severity: "medium", evidence: "UX risk" },
    ],
    process: [
      { title: "Manual handoff slows resolution", detail: `A key workflow in ${name} requires a manual handoff that inflates cycle time.`, severity: "high", evidence: "Process map (anticipated)" },
      { title: "Swivel-chair across systems", detail: "Staff navigate multiple systems to complete one task.", severity: "medium", evidence: "Ops friction" },
    ],
    regulatory: isHealth
      ? [
          { title: "HIPAA constraints on member data", detail: "Any feature surfacing PHI needs privacy/security review and audit logging.", severity: "high", evidence: "HIPAA" },
          { title: "CMS communication & timeliness rules", detail: "Member communications and appeals timelines are regulated; missed timelines are compliance risk.", severity: "high", evidence: "CMS" },
          { title: "Accessibility & language access", detail: "Member-facing content must meet readability and language-access requirements.", severity: "medium", evidence: "Regulatory" },
        ]
      : [
          { title: "Data privacy obligations", detail: `${name} likely handles personal data; ensure consent, retention, and access controls.`, severity: "high", evidence: "Privacy regs (GDPR/CCPA)" },
          { title: "Accessibility requirements", detail: "Ensure the product meets accessibility standards.", severity: "medium", evidence: "Regulatory" },
        ],
    knowledge: [
      { title: "Undocumented critical flow", detail: `A core flow in ${name} is under-documented; capture what it does before it drifts.`, severity: "medium", evidence: "Knowledge risk (anticipated)" },
      { title: "Single-owner knowledge risk", detail: "Key logic understood by one person; preserve and share it.", severity: "high", evidence: "Bus-factor risk" },
      { title: "Behavior drift vs. intent", detail: "Connect to the codebase to detect where behavior has drifted from the documented intent.", severity: "medium", evidence: "Maturity: code connect" },
    ],
  };
  return table[agentId] ?? [];
}
