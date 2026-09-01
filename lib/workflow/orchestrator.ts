/**
 * Orchestrator — the coordinating layer.
 *  - classify the input type (problem/idea/solution/requirement/transcript)
 *  - suggest which agents are relevant for this input
 */
import { getProvider } from "../llm/provider";
import type { AgentId, InputType, IntakeField } from "./types";

/* --------------------------- Business context ---------------------------- */

/**
 * The foundation every discovery starts from — understood BEFORE the agents
 * and the users. Shown for every use case; auto-captured from the input.
 */
export const CONTEXT_QUESTIONS: { id: string; question: string; required: boolean }[] = [
  { id: "industry", question: "What industry / domain is this in?", required: true },
  { id: "business_process", question: "What business process or area does it touch?", required: true },
  { id: "objective", question: "What business objective or outcome is behind it?", required: true },
  { id: "source", question: "Where is this coming from? (a trend, a leadership ask, research, data…)", required: false },
  { id: "stakeholders", question: "Who are the key stakeholders / owners?", required: false },
];

const CONTEXT_SYSTEM =
  "You are a product strategist framing a discovery. You establish the business context first: the industry, the business process involved, the underlying objective, and where the request originated. You only fill fields the input actually supports; leave the rest blank.";

/** Auto-fill the business-context foundation from the input. */
export async function extractContext(input: string, inputType: InputType): Promise<IntakeField[]> {
  const provider = await getProvider();
  let filled: Record<string, string> = {};
  if (provider.mode === "live") {
    try {
      const q = CONTEXT_QUESTIONS.map((x) => `- ${x.id}: ${x.question}`).join("\n");
      const raw = await provider.generateJson<{ answers?: Record<string, string> }>({
        system: CONTEXT_SYSTEM,
        prompt: `INPUT TYPE: ${inputType}\nINPUT:\n"""\n${input.slice(0, 6000)}\n"""\n\nFill any of these you can (leave blank if unknown). Return JSON { "answers": { "<id>": "<value>" } } using only these ids:\n${q}`,
        maxTokens: 600,
      });
      filled = raw?.answers ?? {};
    } catch {
      filled = demoContext(input);
    }
  } else {
    filled = demoContext(input);
  }
  return CONTEXT_QUESTIONS.map((x) => {
    const value = (filled[x.id] || "").trim();
    return { id: x.id, question: x.question, value, captured: Boolean(value), required: x.required };
  });
}

function demoContext(input: string): Record<string, string> {
  const t = input.toLowerCase();
  const clip = input.trim().replace(/\s+/g, " ").slice(0, 160);
  let industry = "General consumer/enterprise software";
  let process = "";
  if (/payer|member|health|insur|claim|medicare|patient|clinical|provider|pharmacy/.test(t)) {
    industry = "US healthcare / payer";
    if (/claim/.test(t)) process = "Claims / member servicing";
    else if (/benefit|cost|coverage/.test(t)) process = "Benefits & coverage understanding";
    else process = "Member experience";
  } else if (/bank|payment|fintech|loan|credit/.test(t)) {
    industry = "Financial services";
    process = "Payments / account servicing";
  } else if (/shop|retail|ecommerce|cart|checkout/.test(t)) {
    industry = "Retail / e-commerce";
    process = "Shopping & checkout";
  }
  const out: Record<string, string> = { industry };
  if (process) out.business_process = process;
  if (clip) out.objective = `Improve the outcome behind: “${clip}”`;
  return out;
}

export async function classifyInput(input: string): Promise<InputType> {
  const provider = await getProvider();
  if (provider.mode === "live") {
    try {
      const raw = await provider.generateJson<{ type?: string }>({
        system: "You classify a piece of product input.",
        prompt: `Classify this input as one of: problem, idea, solution, requirement, transcript.\nReturn JSON { "type": "<one>" }.\n\nINPUT:\n"""\n${input.slice(0, 3000)}\n"""`,
        maxTokens: 50,
      });
      const t = (raw?.type || "").toLowerCase();
      if (["problem", "idea", "solution", "requirement", "transcript"].includes(t)) return t as InputType;
    } catch {
      /* fall through */
    }
  }
  return demoClassify(input);
}

function demoClassify(input: string): InputType {
  const t = input.toLowerCase();
  const lines = input.split(/\r?\n/).filter((l) => l.trim()).length;
  // Transcript: many lines, speaker labels, or dialogue markers.
  if (lines >= 6 && /(^|\n)\s*[A-Z][a-z]+\s*:/.test(input)) return "transcript";
  if (/\b(as a|i want|so that|acceptance criteria|shall|must)\b/.test(t)) return "requirement";
  if (/\b(we should build|let's build|solution|implement|feature that)\b/.test(t)) return "solution";
  if (/\b(what if|idea|maybe we|could we|concept)\b/.test(t)) return "idea";
  if (/\b(can't|cannot|problem|issue|struggle|pain|fails|broken|frustrat)\b/.test(t)) return "problem";
  return "problem";
}

/** Suggest which agents to run for this input. */
export async function suggestAgents(input: string): Promise<AgentId[]> {
  const t = input.toLowerCase();
  const set = new Set<AgentId>(["user_research", "market", "business_priority"]);
  if (/app|product|portal|screen|mobile|web|experience|ux|bug|defect|error/.test(t)) set.add("defect_detection");
  if (/process|workflow|handoff|manual|operation|intake|approval|queue/.test(t)) set.add("process_mining");
  if (/payer|member|health|insur|claim|medicare|patient|clinical|pharmacy|bank|payment|pii|phi|regulat|complian/.test(t)) set.add("regulatory");
  // Default: if nothing domain-specific, still include process + defects (common).
  if (set.size < 4) { set.add("defect_detection"); set.add("process_mining"); }
  return [...set];
}
