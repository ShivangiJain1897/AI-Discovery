/**
 * The agent team. Each agent declares the INTAKE it needs, can EXTRACT what it
 * can from the input, and RUNS to produce findings.
 *
 * Live mode uses Claude; demo mode uses deterministic generators so the whole
 * flow works with no API key. Agents branch on provider.mode.
 */
import { getProvider } from "../llm/provider";
import type { AgentId, Finding, InputType, IntakeField } from "./types";

export interface AgentMeta {
  id: AgentId;
  name: string;
  icon: string;
  blurb: string;
  /** The system persona used in live mode. */
  system: string;
  /** The questions this agent needs answered (its intake form). */
  questions: { id: string; question: string; required: boolean }[];
}

export const AGENTS: AgentMeta[] = [
  {
    id: "user_research",
    name: "User Research",
    icon: "🧑‍🔬",
    blurb: "Understands the user — who they are, their jobs, needs, and pains.",
    system:
      "You are a senior user researcher. You deeply understand users: their segments, jobs-to-be-done, needs, pains, and behaviors. You are evidence-seeking and avoid unfounded claims.",
    questions: [
      { id: "users", question: "Who are the primary users / personas?", required: true },
      { id: "context", question: "What's the domain / context they operate in?", required: true },
      { id: "job", question: "What outcome or job are they trying to accomplish?", required: true },
      { id: "known_pains", question: "What do we already know about their pain points?", required: false },
    ],
  },
  {
    id: "process_mining",
    name: "Process Mining",
    icon: "⚙️",
    blurb: "Maps the current process — handoffs, manual steps, and bottlenecks.",
    system:
      "You are a process analyst. You map end-to-end processes, find manual handoffs, rework, and bottlenecks, and identify automation opportunities.",
    questions: [
      { id: "process", question: "What is the end-to-end process involved?", required: true },
      { id: "actors", question: "Which teams / systems participate?", required: true },
      { id: "handoffs", question: "Where do handoffs or manual steps occur?", required: false },
      { id: "bottlenecks", question: "Known bottlenecks or cycle-time issues?", required: false },
    ],
  },
  {
    id: "defect_detection",
    name: "Defect Detection",
    icon: "🐞",
    blurb: "Surfaces current defects and reliability issues in the experience.",
    system:
      "You are a QA / reliability lead. You find production defects and UX failures and tie each to user impact and severity.",
    questions: [
      { id: "product", question: "Which application / product / experience is involved?", required: true },
      { id: "channels", question: "What platforms / channels (web, mobile, IVR, chat)?", required: false },
      { id: "known_defects", question: "Any known defect areas or recent incidents?", required: false },
      { id: "signals", question: "What signals do we have (reviews, tickets, telemetry)?", required: false },
    ],
  },
  {
    id: "market",
    name: "Market & Competitive",
    icon: "📈",
    blurb: "Analyzes the market, competitors, and shifting expectations.",
    system:
      "You are a market and competitive intelligence analyst. You frame the market, name competitors and benchmarks, and identify shifts in expectations.",
    questions: [
      { id: "market", question: "What market / category is this in?", required: true },
      { id: "competitors", question: "Who are the key competitors or alternatives?", required: false },
      { id: "trends", question: "What trends or expectations are shifting?", required: false },
      { id: "positioning", question: "What is our current positioning?", required: false },
    ],
  },
  {
    id: "regulatory",
    name: "Regulatory & Environment",
    icon: "⚖️",
    blurb: "Government regulations, PHI, and compliance in the operating environment.",
    system:
      "You are a regulatory and compliance analyst. You know the regulations relevant to a domain — HIPAA/CMS for US healthcare, GDPR/CCPA for consumer data, etc. — and the data/privacy constraints that apply.",
    questions: [
      { id: "domain", question: "What domain / jurisdiction (e.g. US healthcare)?", required: true },
      { id: "data_types", question: "What data types are involved (PHI, PII, payment)?", required: true },
      { id: "regs", question: "Which regulations may apply (HIPAA, CMS, GDPR…)?", required: false },
      { id: "constraints", question: "Any compliance constraints already known?", required: false },
    ],
  },
  {
    id: "business_priority",
    name: "Business Priority",
    icon: "🎯",
    blurb: "Assesses business goals, value, effort, and strategic priority.",
    system:
      "You are a product strategy / value analyst. You connect work to business goals, estimate value and effort honestly, and flag strategic priority.",
    questions: [
      { id: "goal", question: "What business goal or KPI does this support?", required: true },
      { id: "value", question: "What's the expected value / impact?", required: false },
      { id: "effort", question: "What's the rough effort / complexity?", required: false },
      { id: "mandate", question: "Any strategic mandate or deadline?", required: false },
    ],
  },
];

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
        system: agent.system + " You only fill fields the input actually supports; leave the rest blank.",
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
  // Fill "context / domain / market / jurisdiction"-type fields from detection.
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
  const raw = await provider.generateJson<{ summary?: string; findings?: { title: string; detail: string }[] }>({
    system: agent.system,
    prompt: `INPUT:\n"""\n${input.slice(0, 6000)}\n"""\n\nWhat we know (intake):\n${known || "(little provided)"}\n\nProduce your findings. Return JSON: { "summary": string, "findings": [ { "title": string, "detail": string } ] } with 3-5 specific findings.`,
    maxTokens: 1800,
  });
  const findings = (raw?.findings ?? []).filter((f) => f && f.title).map((f, i) => finding(f.title, f.detail, i));
  return { summary: String(raw?.summary ?? ""), findings };
}

function finding(title: string, detail: string, i: number): Finding {
  return { id: `f${i + 1}`, title: String(title).slice(0, 160), detail: String(detail ?? ""), verdict: null };
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
      summary: "Market and competitive framing for the idea.",
      f: [
        ["AI concierge is becoming table stakes", "Leading products complete tasks end-to-end, resetting expectations from search to resolution."],
        ["Transparency expectations rising", d.health ? "Price/cost transparency pressure is increasing for members." : "Users expect clearer pricing and status."],
        ["Incumbents slow to modernize UX", "Opportunity to win on a modern, resolution-first experience."],
      ],
    },
    regulatory: d.health
      ? {
          summary: "Regulatory & compliance considerations for a US healthcare/payer context.",
          f: [
            ["HIPAA governs any PHI shown or sent", "Features surfacing member health data require privacy/security review and audit logging."],
            ["CMS rules on communications & timeliness", "Member communications, marketing, and appeals timelines are regulated; misses are compliance risk."],
            ["Accessibility & language access", "Member-facing content must meet readability and language-access requirements."],
          ],
        }
      : {
          summary: "Regulatory & environment considerations.",
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
  // Weave a hint of the user's intake context into the summary.
  const ctxNote = intake.find((f) => f.value)?.value;
  return {
    summary: b.summary + (ctxNote ? ` Context: ${ctxNote.slice(0, 120)}` : ""),
    findings: b.f.map(([t, det], i) => finding(t, det, i)),
  };
}
