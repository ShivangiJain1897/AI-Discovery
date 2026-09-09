/**
 * LAYER 4 — generate an artifact.
 *
 * Critically: this reads the session dossier and NOTHING ELSE. Asking for a
 * second format never re-runs research — a PRD, a backlog and an executive
 * summary generated from the same session all draw on the same evidence,
 * synthesis, analyses and decision.
 */
import { getProvider } from "../llm/provider";
import { getAudience, getDepth } from "./catalog/depth";
import { getOutput, getOutputFamily, outputAsk } from "./catalog/outputs";
import { evidenceDossier } from "./dossier";
import { normalizeSections } from "./sections";
import { EVIDENCE_DISCIPLINE, GENERATOR_DISCIPLINE } from "./universal";
import type { Artifact, AudienceId, DepthMode, DocSection, Session } from "./types";

export async function generateArtifact(
  session: Session,
  outputId: string,
  overrides: { depth?: DepthMode; audience?: AudienceId } = {}
): Promise<Artifact> {
  const def = getOutput(outputId);
  if (!def) throw new Error(`Unknown output: ${outputId}`);
  const family = getOutputFamily(def.familyId);
  const depth = overrides.depth ?? session.plan.depth;
  const audience = overrides.audience ?? session.plan.audience;
  const provider = await getProvider();

  let sections: DocSection[];
  if (provider.mode === "live") {
    try {
      sections = await live(session, outputId, depth, audience);
    } catch {
      sections = notGenerated(session, outputId);
    }
  } else {
    sections = notGenerated(session, outputId);
  }

  return {
    id: `art_${Math.random().toString(36).slice(2, 8)}`,
    outputId,
    family: family?.name ?? def.familyId,
    title: def.name,
    depth,
    audience,
    sections,
    createdAt: Date.now(),
  };
}

async function live(
  session: Session,
  outputId: string,
  depthId: DepthMode,
  audienceId: AudienceId
): Promise<DocSection[]> {
  const def = getOutput(outputId)!;
  const provider = await getProvider();
  const depth = getDepth(depthId);
  const audience = getAudience(audienceId);

  const readiness = readinessNote(session, outputId);

  const raw = await provider.generateJson<{ sections?: DocSection[] }>({
    system: `${EVIDENCE_DISCIPLINE}\n\n---\n\n${GENERATOR_DISCIPLINE}`,
    prompt: `${evidenceDossier(session)}

${depth.directive}
${audience.directive}
${readiness}

Now produce: ${def.name}.

${outputAsk(def)}

Return JSON: { "sections": [ { "heading": string, "method"?: string, "body"?: string, "bullets"?: string[], "table"?: { "headers": string[], "rows": string[][] } } ] }

Use "method" to name a methodology where one is being applied to a section. Every table row must trace to the dossier above. Omit any section the evidence cannot support, and where a required section has no evidence behind it, say so in that section rather than filling it with generic content.`,
    maxTokens: depth.budget,
  });

  const sections = normalizeSections(raw?.sections);
  return sections.length ? sections : notGenerated(session, outputId);
}

/** Tell the generator plainly how solid the ground under this artifact is. */
function readinessNote(session: Session, outputId: string): string {
  const def = getOutput(outputId)!;
  const hasEvidence = session.streams.some((s) => s.selected && s.status === "complete");
  const hasSynthesis = Boolean(session.synthesis);
  const hasDecision = Boolean(session.decision);

  if (def.needs === "decision" && !hasDecision) {
    return "\nNOTE: no decision brief exists in this session yet. Derive the recommendation from the synthesis, state its confidence explicitly, and say in the document that it has not been through a formal options analysis.";
  }
  if (def.needs === "synthesis" && !hasSynthesis) {
    return "\nNOTE: no cross-stream synthesis exists yet. Work from the raw stream evidence, and be explicit that the connections between lenses have not been made.";
  }
  if (!hasEvidence) {
    return "\nNOTE: NO research evidence exists in this session. Do not write a document that implies otherwise. Produce the structure with each section stating what evidence it needs, and make the gap the headline.";
  }
  return "";
}

/**
 * Demo mode / failure. The structure of the artifact is real information — it
 * tells the PM what the document contains and what it needs — so we render
 * that, and refuse to fill it with invented content.
 */
function notGenerated(session: Session, outputId: string): DocSection[] {
  const def = getOutput(outputId)!;
  const family = getOutputFamily(def.familyId);
  const streams = session.streams.filter((s) => s.selected && s.status === "complete");
  const rows = streams.flatMap((s) => s.findings.map((f) => [f.title, s.capabilityId, f.strength]));

  const sections: DocSection[] = [
    {
      heading: `${def.name} — not generated`,
      body: `${session.mode === "demo" ? "The app is in demo mode (no ANTHROPIC_API_KEY set)." : "The live generation call did not return a usable document."} Writing a plausible-looking ${def.name.toLowerCase()} from no evidence is exactly the failure this system is built to prevent, so nothing has been invented here.`,
      bullets: [
        `Family: ${family?.name ?? def.familyId}`,
        `Purpose: ${def.blurb}`,
        `Requires in the session: ${def.needs === "decision" ? "a decision brief" : def.needs === "synthesis" ? "cross-stream synthesis" : "research evidence"}`,
      ],
    },
  ];
  if (rows.length) {
    sections.push({
      heading: "What the session actually contains",
      table: { headers: ["Finding", "Lens", "Strength"], rows },
    });
  }
  if (session.synthesis) {
    sections.push({ heading: "Synthesis headline", body: session.synthesis.headline });
  }
  sections.push({
    heading: "To generate this",
    bullets: [
      "Set ANTHROPIC_API_KEY and re-run the research streams so there is real evidence to write from.",
      "Or paste the evidence you already have into the session — it is carried into every artifact.",
      "Then generate this artifact again; nothing needs to be re-researched.",
    ],
  });
  return sections;
}
