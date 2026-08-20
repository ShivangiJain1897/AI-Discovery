/**
 * AI-assisted product brief drafting. From a one-liner, produce a structured
 * brief the PM can refine. Live via Claude (editable prompt); demo via a
 * deterministic template that echoes the one-liner into the right fields.
 */
import { getProvider } from "../llm/provider";
import { getEffectivePrompt } from "../capabilities/prompt-store";
import type { ProductBrief } from "./types";

const SHAPE = `Return a JSON object with these string fields (kpis is an array of 3-5 short strings):
{ "overview": string, "targetUsers": string, "valueProp": string, "platform": string, "market": string, "regulatoryContext": string, "kpis": string[] }`;

export async function draftBrief(name: string, oneLiner: string): Promise<ProductBrief> {
  const provider = await getProvider();
  if (provider.mode === "demo") return demoBrief(name, oneLiner);

  const def = await getEffectivePrompt("product_brief");
  const prompt = `PRODUCT NAME: ${name}\nONE-LINER: ${oneLiner}\n\n${def.task}\n\n${SHAPE}`;
  try {
    const raw = await provider.generateJson<Partial<ProductBrief>>({ system: def.system, prompt, maxTokens: 1500 });
    return {
      overview: str(raw.overview) || oneLiner,
      targetUsers: str(raw.targetUsers),
      valueProp: str(raw.valueProp),
      platform: str(raw.platform),
      market: str(raw.market),
      regulatoryContext: str(raw.regulatoryContext),
      kpis: Array.isArray(raw.kpis) ? raw.kpis.map(String).slice(0, 6) : [],
    };
  } catch {
    return demoBrief(name, oneLiner);
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function demoBrief(name: string, oneLiner: string): ProductBrief {
  const d = oneLiner.toLowerCase();
  const isHealth = /payer|member|health|insur|claim|medicare|patient/.test(d);
  return {
    overview: `${name} — ${oneLiner}. (Draft: refine this overview with the real product context.)`,
    targetUsers: isHealth ? "Health-plan members and the staff who support them." : "The primary users described in the one-liner, plus internal staff who support them.",
    valueProp: "Deliver the core outcome in the one-liner with less effort and more trust than the status quo.",
    platform: isHealth ? "Member web portal and mobile app." : "Web and mobile app (adjust to your stack).",
    market: isHealth ? "US health-payer market; consumer-grade expectations are reshaping member experience." : "Set by adjacent consumer apps; expectations are rising toward task-completion and transparency.",
    regulatoryContext: isHealth ? "HIPAA (PHI), CMS marketing/appeals rules, Star Ratings, accessibility & language access." : "Data privacy (GDPR/CCPA), accessibility standards; add domain-specific regulations.",
    kpis: isHealth
      ? ["Member NPS", "First-contact resolution", "Digital self-service adoption", "Retention"]
      : ["Activation rate", "Retention", "Task-completion rate", "NPS/CSAT"],
  };
}
