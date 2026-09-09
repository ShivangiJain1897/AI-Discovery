/**
 * LAYER 2 — applying an analytical method to the evidence.
 *
 * Analysis reasons over evidence that has ALREADY been gathered. It never
 * triggers new research. Each method produces its own structured deliverable
 * using its own section spec (or its family's default).
 */
import { getProvider } from "../llm/provider";
import { getFamily, getMethod, methodAsk } from "./catalog/analysis";
import { getAudience, getDepth } from "./catalog/depth";
import { EVIDENCE_DISCIPLINE, GENERATOR_DISCIPLINE } from "./universal";
import { evidenceDossier } from "./dossier";
import { normalizeSections } from "./sections";
import type { AnalysisRun, DocSection, Session } from "./types";

export async function runAnalysis(session: Session, methodId: string): Promise<AnalysisRun> {
  const method = getMethod(methodId);
  if (!method) throw new Error(`Unknown analysis method: ${methodId}`);
  const family = getFamily(method.familyId);
  const provider = await getProvider();

  let sections: DocSection[];
  if (provider.mode === "live") {
    try {
      sections = await live(session, methodId);
    } catch {
      sections = notRun(session, methodId);
    }
  } else {
    sections = notRun(session, methodId);
  }

  return {
    id: `an_${Math.random().toString(36).slice(2, 8)}`,
    methodId,
    name: method.name,
    method: method.method,
    family: family?.name ?? method.familyId,
    sections,
    createdAt: Date.now(),
  };
}

async function live(session: Session, methodId: string): Promise<DocSection[]> {
  const method = getMethod(methodId)!;
  const provider = await getProvider();
  const depth = getDepth(session.plan.depth);
  const audience = getAudience(session.plan.audience);

  const raw = await provider.generateJson<{ sections?: DocSection[] }>({
    system: `${EVIDENCE_DISCIPLINE}\n\n---\n\n${GENERATOR_DISCIPLINE}\n\n---\n\nYou are applying ONE analytical method: ${method.name} (${method.method}). Apply it properly — a named method done loosely is worse than no method, because it borrows credibility it has not earned.\n\nThis method requires: ${method.evidenceNeeded}\nIf that evidence is not in the material below, say so in the first section and produce what the method CAN honestly yield, marking the rest as gaps. Do not fabricate inputs so the framework looks complete.`,
    prompt: `${evidenceDossier(session)}

${depth.directive}
${audience.directive}

Apply ${method.name}.

${methodAsk(method)}

Return JSON: { "sections": [ { "heading": string, "method"?: string, "body"?: string, "bullets"?: string[], "table"?: { "headers": string[], "rows": string[][] } } ] }

Set "method" on the section where the methodology is being applied. Use tables where a matrix communicates better than prose; every row must trace to the evidence above. Omit any section the evidence cannot support rather than padding it.`,
    maxTokens: depth.budget,
  });

  const sections = normalizeSections(raw?.sections);
  return sections.length ? sections : notRun(session, methodId);
}

/**
 * Demo mode / failure: state honestly that the method did not run, and show
 * what it would need. Never emit a fabricated framework output.
 */
function notRun(session: Session, methodId: string): DocSection[] {
  const method = getMethod(methodId)!;
  const family = getFamily(method.familyId);
  const streams = session.streams.filter((s) => s.selected && s.status === "complete");
  const evidenceRows = streams.flatMap((s) =>
    s.findings.map((f) => [f.title, s.capabilityId, f.strength, firstSentence(f.detail)])
  );

  const sections: DocSection[] = [
    {
      heading: `${method.name} — not run`,
      method: method.method,
      body: `This analysis was not performed. ${session.mode === "demo" ? "The app is in demo mode (no ANTHROPIC_API_KEY), and fabricating a framework output would violate the evidence discipline this system runs on." : "The live call did not return a usable result."} What is real below is the evidence already in the session.`,
      bullets: [
        `Method: ${method.method} (family: ${family?.name ?? method.familyId})`,
        `What it answers: ${method.blurb}`,
        `Evidence it requires: ${method.evidenceNeeded}`,
      ],
    },
  ];
  if (evidenceRows.length) {
    sections.push({
      heading: "Evidence currently in the session",
      method: "Evidence grading",
      table: { headers: ["Finding", "Lens", "Strength", "Why it matters"], rows: evidenceRows },
    });
  }
  sections.push({
    heading: "To run this properly",
    bullets: [
      "Set ANTHROPIC_API_KEY so the research streams and this analysis run live.",
      `Supply the evidence this method needs: ${method.evidenceNeeded}`,
      "Or paste what you already have into the session — it is carried into every analysis.",
    ],
  });
  return sections;
}

function firstSentence(s: string): string {
  const m = (s || "").split(/(?<=[.!?])\s/)[0] || s || "";
  return m.length > 140 ? m.slice(0, 137) + "…" : m;
}
