/**
 * Generators — turn the VALIDATED findings into a deliverable (PRD or backlog).
 * Only findings the user didn't mark "incorrect" are used, plus their notes.
 */
import { getProvider } from "../llm/provider";
import { getAgent } from "./agents";
import type { GeneratedOutput, Workflow } from "./types";

interface Section { heading: string; body?: string; bullets?: string[] }

/** Collect the validated findings + notes as readable context. */
function validatedContext(w: Workflow): { blocks: string[]; perAgent: { name: string; bullets: string[]; notes?: string }[] } {
  const blocks: string[] = [];
  const perAgent: { name: string; bullets: string[]; notes?: string }[] = [];
  for (const a of w.agents) {
    if (!a.selected || a.status !== "complete") continue;
    const kept = a.findings.filter((f) => f.verdict !== "incorrect");
    if (kept.length === 0 && !a.userNotes) continue;
    const name = getAgent(a.agentId)?.name ?? a.agentId;
    const bullets = kept.map((f) => `${f.title}: ${f.detail}`);
    if (a.userNotes) bullets.push(`(Team note) ${a.userNotes}`);
    perAgent.push({ name, bullets: kept.map((f) => f.title), notes: a.userNotes });
    blocks.push(`## ${name}\n${bullets.map((b) => `- ${b}`).join("\n")}`);
  }
  return { blocks, perAgent };
}

export async function generate(w: Workflow, kind: "prd" | "backlog"): Promise<GeneratedOutput> {
  const provider = await getProvider();
  const { blocks } = validatedContext(w);
  let sections: Section[];

  if (provider.mode === "live") {
    try {
      sections = await live(w, kind, blocks.join("\n\n"));
    } catch {
      sections = demo(w, kind);
    }
  } else {
    sections = demo(w, kind);
  }

  return {
    id: `${kind}_${Math.random().toString(36).slice(2, 7)}`,
    kind,
    title: kind === "prd" ? "PRD" : "Prioritized backlog",
    sections,
    createdAt: Date.now(),
  };
}

async function live(w: Workflow, kind: "prd" | "backlog", context: string): Promise<Section[]> {
  const provider = await getProvider();
  const shape = `Return JSON { "sections": [ { "heading": string, "body": string, "bullets": string[] } ] }.`;
  const ask =
    kind === "prd"
      ? "Write a concise PRD with sections: Problem & Context, Goals, Users & Insights, Requirements, Risks & Compliance, Success Metrics. Ground it in the findings."
      : "Produce a prioritized product backlog: sections grouped as Now / Next / Later, each with bullet items derived from the findings.";
  const raw = await provider.generateJson<{ sections?: Section[] }>({
    system: "You are a senior product manager turning validated discovery findings into a deliverable.",
    prompt: `ORIGINAL INPUT (${w.inputType}):\n"""\n${w.input.slice(0, 3000)}\n"""\n\nVALIDATED FINDINGS:\n${context || "(none)"}\n\n${ask}\n\n${shape}`,
    maxTokens: 2600,
  });
  const s = Array.isArray(raw?.sections) ? raw.sections : [];
  return s.length ? s.map(norm) : demo(w, kind);
}

function norm(s: Section): Section {
  return {
    heading: String(s.heading || "Section"),
    body: s.body ? String(s.body) : undefined,
    bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : undefined,
  };
}

function demo(w: Workflow, kind: "prd" | "backlog"): Section[] {
  const { perAgent } = validatedContext(w);
  const clip = w.input.trim().replace(/\s+/g, " ").slice(0, 300);

  if (kind === "backlog") {
    const bullets: string[] = [];
    for (const a of perAgent) for (const t of a.bullets) bullets.push(`[${a.name}] ${t}`);
    return [
      { heading: "How this was prioritized", body: "Items derived from your validated findings. Refine order and add estimates in your tracker." },
      { heading: "Backlog items", bullets: bullets.length ? bullets : ["No validated findings yet — run agents and validate first."] },
    ];
  }

  // PRD
  const sections: Section[] = [
    { heading: "Problem & Context", body: `Derived from your ${w.inputType}:\n“${clip}”` },
    { heading: "Goals", bullets: ["Address the core problem the input describes", "Improve the target outcome with less effort and more trust"] },
  ];
  for (const a of perAgent) {
    sections.push({ heading: a.name, bullets: a.bullets.length ? a.bullets : undefined, body: a.notes ? `Team note: ${a.notes}` : undefined });
  }
  sections.push({ heading: "Requirements", bullets: ["Functional requirements for the primary happy path", "Error/edge handling for the key failure cases", "Accessibility & compliance requirements"] });
  sections.push({ heading: "Success Metrics", bullets: ["Adoption / task-completion", "Reduction in avoidable contacts", "Satisfaction (CSAT/NPS)"] });
  return sections;
}
