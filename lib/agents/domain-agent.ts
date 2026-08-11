import { getProvider } from "../llm/provider";
import { MEMBER_VALUE_CHAIN, KPIS, PERSONAS } from "../domain/member-value-chain";
import type { DiscoveryContext, DomainBrief } from "./types";

/**
 * Domain Context Agent.
 *
 * Establishes the shared understanding the other agents rely on: which member
 * personas matter, which KPIs to optimize, which regulations constrain the work,
 * and where the leverage is right now. Its brief is injected into every other
 * agent's context.
 */
export const DOMAIN_AGENT = {
  id: "domain" as const,
  name: "Domain Context Agent",
  tagline: "Learns the payer's member value chain and grounds every other agent.",
  description:
    "Builds a domain brief from the member value chain — personas, priority KPIs, regulatory constraints, and the highest-leverage stages — so all downstream analysis is anchored in payer reality.",
};

const SYSTEM = `You are the Domain Context Agent for a health-insurance PAYER's MEMBER value chain.
You deeply understand health-plan operations: enrollment, benefits, claims/EOB, care and utilization management, pharmacy/PBM, grievances & appeals, and member retention.
You know the regulatory frame: HIPAA, CMS marketing and appeals rules, CMS Star Ratings, and readability/language-access requirements.
Your job is to produce a concise domain brief that grounds four downstream agents (defect detection, market analysis, process analysis, and synthesis).
Be specific to payers and members. Avoid generic business jargon.`;

export async function runDomainAgent(ctx: DiscoveryContext): Promise<DomainBrief> {
  const provider = await getProvider();
  const stageList = MEMBER_VALUE_CHAIN.stages
    .map((s) => `- ${s.id}: ${s.name} — ${s.summary} (friction: ${s.knownFriction.join("; ")})`)
    .join("\n");
  const kpiList = KPIS.map((k) => `- ${k.id}: ${k.name}`).join("\n");
  const personaList = PERSONAS.map((p) => `- ${p.name}: ${p.description}`).join("\n");

  const prompt = `Focus: ${ctx.focus?.trim() || "General member experience improvement"}

Member value-chain stages:
${stageList}

Known KPIs:
${kpiList}

Personas:
${personaList}

Produce a JSON object with this exact shape:
{
  "summary": string,                       // 2-4 sentences grounding the discovery
  "personas": [{ "name": string, "motivation": string }],   // 3 most relevant
  "priorityKpis": [{ "kpi": string, "why": string }],       // 3-4, use KPI display names
  "constraints": string[],                 // regulatory/compliance constraints to respect
  "focusStages": string[]                  // 3-5 stage ids from the list above, highest leverage first
}`;

  return provider.generateJson<DomainBrief>({
    system: SYSTEM,
    prompt,
    mockKey: "domain-brief",
    maxTokens: 1500,
  });
}
