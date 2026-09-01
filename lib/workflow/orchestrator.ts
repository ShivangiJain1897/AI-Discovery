/**
 * Orchestrator — the coordinating layer.
 *  - classify the input type (problem/idea/solution/requirement/transcript)
 *  - suggest which agents are relevant for this input
 */
import { getProvider } from "../llm/provider";
import type { AgentId, InputType } from "./types";

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
