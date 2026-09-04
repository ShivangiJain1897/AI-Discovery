/**
 * The agent team — engine.
 *
 * Each agent's editable definition (name, icon, blurb, system prompt, intake
 * questions, research flag) lives in its own file under `./prompts`. THIS file
 * is the machinery: extracting intake, optionally doing live web research, and
 * running each agent to produce findings.
 *
 * Live mode uses Claude; demo mode uses deterministic generators so the whole
 * flow works with no API key. Agents branch on provider.mode.
 *
 * ► To tune an agent's prompt or questions, edit its file in `./prompts`.
 */
import { getProvider } from "../llm/provider";
import { AGENT_PROMPTS, type AgentPrompt } from "./prompts";
import { UNIVERSAL_SYSTEM } from "./prompts/_universal";
import type { AgentId, EvidenceStrength, Finding, InputType, IntakeField } from "./types";

export type AgentMeta = AgentPrompt;

/** The agent catalog, read from the per-agent prompt files. */
export const AGENTS: AgentMeta[] = AGENT_PROMPTS;

export function getAgent(id: AgentId): AgentMeta | undefined {
  return AGENTS.find((a) => a.id === id);
}

/* ------------------------------- Extraction ------------------------------- */

/** Auto-fill an agent's intake from the input; returns IntakeFields. */
export async function extractIntake(
  agentId: AgentId,
  input: string,
  inputType: InputType
): Promise<IntakeField[]> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);
  const provider = await getProvider();

  let filled: Record<string, string> = {};
  if (provider.mode === "live") {
    try {
      const q = agent.questions.map((x) => `- ${x.id}: ${x.question}`).join("\n");
      const raw = await provider.generateJson<{ answers?: Record<string, string> }>({
        system: agent.system + "\n\nYou only fill fields the input actually supports; leave the rest blank.",
        prompt: `INPUT TYPE: ${inputType}\nINPUT:\n"""\n${input.slice(0, 6000)}\n"""\n\nFrom the input, fill any of these fields you can (leave blank if unknown). Return JSON { "answers": { "<id>": "<value>" } } using only these ids:\n${q}`,
        maxTokens: 800,
      });
      filled = raw?.answers ?? {};
    } catch {
      filled = demoExtract(agentId, input);
    }
  } else {
    filled = demoExtract(agentId, input);
  }

  return agent.questions.map((x) => {
    const value = (filled[x.id] || "").trim();
    return { id: x.id, question: x.question, value, captured: Boolean(value), required: x.required };
  });
}

function demoExtract(agentId: AgentId, input: string): Record<string, string> {
  const domain = detectDomain(input);
  const clip = input.trim().replace(/\s+/g, " ").slice(0, 140);
  const out: Record<string, string> = {};
  const agent = getAgent(agentId)!;
  for (const q of agent.questions) {
    if (/context|domain|market|jurisdiction/.test(q.id) || /context|domain|market|jurisdiction/.test(q.question.toLowerCase())) {
      out[q.id] = domain.label;
    }
    if (q.id === "data_types" && domain.health) out[q.id] = "Likely PHI / member health data; possibly PII.";
    if ((q.id === "product" || q.id === "process") && clip) out[q.id] = `From the input: “${clip}”`;
  }
  return out;
}

function detectDomain(input: string): { label: string; health: boolean } {
  const t = input.toLowerCase();
  const health = /payer|member|health|insur|claim|medicare|patient|clinical|provider|pharmacy/.test(t);
  if (health) return { label: "US healthcare / payer (members)", health: true };
  if (/bank|payment|fintech|loan|credit/.test(t)) return { label: "Financial services", health: false };
  if (/shop|retail|ecommerce|cart|checkout/.test(t)) return { label: "Retail / e-commerce", health: false };
  return { label: "General consumer/enterprise software", health: false };
}

/* ---------------------------------- Run ----------------------------------- */

export async function runAgent(
  agentId: AgentId,
  input: string,
  intake: IntakeField[]
): Promise<{ summary: string; findings: Finding[] }> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);
  const provider = await getProvider();

  if (provider.mode === "live") {
    try {
      return await runLive(agent, input, intake);
    } catch {
      /* fall back to demo so a run never dead-ends */
    }
  }
  return demoRun(agentId, input, intake);
}

async function runLive(agent: AgentMeta, input: string, intake: IntakeField[]): Promise<{ summary: string; findings: Finding[] }> {
  const provider = await getProvider();
  const known = intake.filter((f) => f.value).map((f) => `- ${f.question} ${f.value}`).join("\n");

  // Optional: live web research for agents that declare research: true.
  let researchBlock = "";
  if (agent.research && typeof provider.research === "function") {
    try {
      const found = await provider.research(researchQuery(agent, input, known));
      if (found && found.trim()) researchBlock = `\n\nLIVE RESEARCH (web search — use and cite these; do not fabricate beyond them):\n${found.trim()}\n`;
    } catch {
      /* research is best-effort — proceed without it */
    }
  }

  const raw = await provider.generateJson<{ summary?: string; findings?: { title: string; detail: string; strength?: string }[] }>({
    system: `${UNIVERSAL_SYSTEM}\n\n---\n\nYOUR SPECIALTY:\n${agent.system}`,
    prompt: `INPUT:\n"""\n${input.slice(0, 6000)}\n"""\n\nWhat we know (intake):\n${known || "(little provided)"}\n${researchBlock}\nProduce your findings. Return JSON: { "summary": string, "findings": [ { "title": string, "detail": string, "strength": "Strong" | "Moderate" | "Directional" | "Hypothesis" } ] } with 3-6 specific, non-generic, actionable findings. Assign each finding's strength honestly per the rules. Where a flow or sequence matters, write the steps out in the detail.`,
    maxTokens: 2400,
  });
  const findings = (raw?.findings ?? []).filter((f) => f && f.title).map((f, i) => finding(f.title, f.detail, i, f.strength));
  return { summary: String(raw?.summary ?? ""), findings };
}

const STRENGTHS: EvidenceStrength[] = ["Strong", "Moderate", "Directional", "Hypothesis"];
function normStrength(s: string | undefined): EvidenceStrength | undefined {
  if (!s) return undefined;
  const hit = STRENGTHS.find((x) => x.toLowerCase() === s.trim().toLowerCase());
  return hit;
}

/** Build the web-search query for a research agent. */
function researchQuery(agent: AgentMeta, input: string, known: string): string {
  const topic = input.trim().replace(/\s+/g, " ").slice(0, 400);
  if (agent.id === "market") {
    return `Research the market and direct competitors for this product idea, plus current trends and shifting expectations. Name specific companies/products and cite sources.\n\nIDEA: ${topic}\n${known}`;
  }
  if (agent.id === "regulatory") {
    return `Research the regulations, data-privacy obligations, and compliance frameworks that apply to this in its industry and jurisdiction. Name the specific regulations and cite sources.\n\nCONTEXT: ${topic}\n${known}`;
  }
  return `Research relevant, current, factual context for: ${topic}\n${known}`;
}

function finding(title: string, detail: string, i: number, strength?: string): Finding {
  return { id: `f${i + 1}`, title: String(title).slice(0, 160), detail: String(detail ?? ""), strength: normStrength(strength), verdict: null };
}

function demoRun(agentId: AgentId, input: string, intake: IntakeField[]): { summary: string; findings: Finding[] } {
  const d = detectDomain(input);
  const ctx = d.health ? "member" : "user";
  const bank: Record<AgentId, { summary: string; f: [string, string][] }> = {
    user_research: {
      summary: `Provisional user insights for the described ${ctx} experience (validate with real research).`,
      f: [
        ["Primary job is to get it done without help", `The ${ctx} wants to complete the task self-service; friction pushes them to support.`],
        ["Trust and clarity drive satisfaction", "Confusing language and opaque status erode trust quickly."],
        ["Caregivers / proxies are a real segment", d.health ? "Family members often act on a member's behalf; the flow must support proxies." : "Some users act on behalf of others; consider delegate access."],
        ["Effort at first-run predicts retention", "A hard first-run experience correlates with drop-off."],
      ],
    },
    process_mining: {
      summary: "How the current process likely flows and where it breaks (anticipated; confirm with process data).",
      f: [
        ["Manual handoff inflates cycle time", "A key step appears to require a manual handoff between teams/systems."],
        ["Swivel-chair across systems", "Staff likely navigate multiple systems to complete one task."],
        ["Late error detection", "Errors are caught downstream instead of at the point of entry."],
      ],
    },
    defect_detection: {
      summary: "Likely production defects to anticipate for this experience (confirm against telemetry).",
      f: [
        ["First-run screen intermittently blank", `New ${ctx}s may hit a blank/spinning screen on first open, driving support contacts.`],
        ["Stale data after updates", "Cached content shown post-update can cause wrong decisions."],
        ["Errors lack a next step", "Coded errors dead-end the user with no recovery path."],
      ],
    },
    market: {
      summary: "Market and competitive framing for the idea (demo mode — enable live mode for cited web research).",
      f: [
        ["AI concierge is becoming table stakes", "Leading products complete tasks end-to-end, resetting expectations from search to resolution."],
        ["Transparency expectations rising", d.health ? "Price/cost transparency pressure is increasing for members." : "Users expect clearer pricing and status."],
        ["Incumbents slow to modernize UX", "Opportunity to win on a modern, resolution-first experience."],
      ],
    },
    regulatory: d.health
      ? {
          summary: "Regulatory & compliance considerations for a US healthcare/payer context (demo mode — enable live mode for cited research).",
          f: [
            ["HIPAA governs any PHI shown or sent", "Features surfacing member health data require privacy/security review and audit logging."],
            ["CMS rules on communications & timeliness", "Member communications, marketing, and appeals timelines are regulated; misses are compliance risk."],
            ["Accessibility & language access", "Member-facing content must meet readability and language-access requirements."],
          ],
        }
      : {
          summary: "Regulatory & environment considerations (demo mode — enable live mode for cited research).",
          f: [
            ["Data privacy obligations", "Handling personal data invokes GDPR/CCPA-style consent, retention, and access controls."],
            ["Accessibility requirements", "The experience must meet accessibility standards."],
          ],
        },
    business_priority: {
      summary: "Business value and priority framing (directional).",
      f: [
        ["High impact on avoidable contact volume", "Solving this likely deflects support contacts and lifts self-service."],
        ["Moderate effort with clear MVP", "A focused MVP can validate value before deeper investment."],
        ["Supports retention & satisfaction KPIs", d.health ? "Ties to NPS, CAHPS/Stars, and retention." : "Ties to activation, retention, and CSAT."],
      ],
    },
  };
  const b = bank[agentId];
  const ctxNote = intake.find((f) => f.value)?.value;
  return {
    summary: b.summary + (ctxNote ? ` Context: ${ctxNote.slice(0, 120)}` : ""),
    // Demo findings are illustrative, not evidence-based — tag them as hypotheses.
    findings: b.f.map(([t, det], i) => finding(t, det, i, "Hypothesis")),
  };
}
