import { getProvider } from "../llm/provider";
import { getCapability } from "./registry";
import { CAP_SEEDS } from "./seeds";
import { getEffectivePrompt } from "./prompt-store";
import { SHARED_SHAPE } from "./prompts";
import type { AnalyzeInput, CapabilityOutput, OutputSection } from "./types";

/**
 * Runs a single capability against the pasted input.
 *
 * Live mode: Claude produces the structured output.
 * Demo mode: a strong hand-authored template (seed) is returned, with the
 * user's actual input woven in where it belongs — so demo still feels responsive
 * without pretending to have analyzed the text.
 */

export async function runCapability(
  capabilityId: string,
  input: AnalyzeInput
): Promise<CapabilityOutput> {
  const meta = getCapability(capabilityId);
  if (!meta) throw new Error(`Unknown capability: ${capabilityId}`);

  const provider = await getProvider();

  if (provider.mode === "demo") {
    return hydrateSeed(capabilityId, input);
  }

  // Effective prompt = Studio override, or the default. Editable at runtime.
  const def = await getEffectivePrompt(capabilityId);
  const prompt = `INPUT TYPE: ${input.inputType}
${input.productContext ? `PRODUCT CONTEXT: ${input.productContext}\n` : ""}
INPUT:
"""
${input.text.slice(0, 8000)}
"""

TASK: ${def.task}

${SHARED_SHAPE}`;

  const raw = await provider.generateJson<Partial<CapabilityOutput>>({
    system: def.system,
    prompt,
    maxTokens: 2600,
  });
  return normalize(capabilityId, raw);
}

function normalize(capabilityId: string, raw: Partial<CapabilityOutput>): CapabilityOutput {
  const meta = getCapability(capabilityId);
  const sections: OutputSection[] = Array.isArray(raw?.sections)
    ? raw.sections
        .filter((s): s is OutputSection => !!s && typeof s.heading === "string")
        .map((s) => ({
          heading: String(s.heading),
          body: s.body ? String(s.body) : undefined,
          bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : undefined,
          table:
            s.table && Array.isArray(s.table.columns) && Array.isArray(s.table.rows)
              ? {
                  columns: s.table.columns.map(String),
                  rows: s.table.rows.map((r) => (Array.isArray(r) ? r.map(String) : [])),
                }
              : undefined,
        }))
    : [];
  return {
    capabilityId,
    title: raw?.title ? String(raw.title) : meta?.name ?? capabilityId,
    summary: raw?.summary ? String(raw.summary) : "",
    sections,
    tags: Array.isArray(raw?.tags) ? raw!.tags!.map(String).slice(0, 6) : undefined,
    note: raw?.note ? String(raw.note) : undefined,
  };
}

/** Fill a demo seed's {{INPUT}} placeholders with the user's real input. */
function hydrateSeed(capabilityId: string, input: AnalyzeInput): CapabilityOutput {
  const seed = CAP_SEEDS[capabilityId];
  const label = shortLabel(input.text);
  const clip = input.text.trim().slice(0, 600);
  const replace = (s: string) =>
    s.replaceAll("{{INPUT}}", clip || "the pasted input").replaceAll("{{LABEL}}", label);

  return {
    capabilityId,
    title: replace(seed.title),
    summary: replace(seed.summary),
    sections: seed.sections.map((sec) => ({
      heading: sec.heading,
      body: sec.body ? replace(sec.body) : undefined,
      bullets: sec.bullets?.map(replace),
      table: sec.table
        ? { columns: sec.table.columns, rows: sec.table.rows.map((r) => r.map(replace)) }
        : undefined,
    })),
    tags: seed.tags,
    note: seed.note,
  };
}

function shortLabel(text: string): string {
  const first = (text || "").trim().split(/\r?\n/)[0] || "your input";
  return first.length > 70 ? first.slice(0, 67) + "…" : first;
}
