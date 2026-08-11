import { getProvider } from "../llm/provider";
import { getCapability } from "./registry";
import { CAP_SEEDS } from "./seeds";
import type { AnalyzeInput, CapabilityOutput, OutputSection } from "./types";

/**
 * Runs a single capability against the pasted input.
 *
 * Live mode: Claude produces the structured output.
 * Demo mode: a strong hand-authored template (seed) is returned, with the
 * user's actual input woven in where it belongs — so demo still feels responsive
 * without pretending to have analyzed the text.
 */

interface CapDef {
  system: string;
  /** Describes the sections we want, appended to a shared shape instruction. */
  task: string;
}

const SHARED_SHAPE = `Return a single JSON object of this exact shape:
{
  "title": string,
  "summary": string,                     // 1-2 sentences
  "sections": [
    {
      "heading": string,
      "body": string,                     // optional prose (omit if using bullets/table)
      "bullets": string[],                // optional
      "table": { "columns": string[], "rows": string[][] }  // optional
    }
  ],
  "tags": string[],                        // optional, 2-5 short labels
  "note": string                           // optional callout
}
Be specific and grounded in the input. Do not invent facts about named companies you are unsure of.`;

const DEFS: Record<string, CapDef> = {
  prd: {
    system:
      "You are a senior product manager. You turn rough inputs (a feature idea, a written requirement, or a meeting transcript) into a crisp, well-structured PRD.",
    task: `Produce a PRD with sections: Problem & Context, Goals & Non-Goals, Target Users & Personas, Requirements (as bullets), Success Metrics, Risks & Open Questions.`,
  },
  requirements: {
    system:
      "You are a senior product manager / BA. You convert inputs into precise, testable requirements.",
    task: `Produce sections: Summary, User Stories (bullets in 'As a __, I want __, so that __' form), Acceptance Criteria (bullets in Given/When/Then form), Edge Cases & NFRs. Keep them implementation-ready.`,
  },
  market: {
    system:
      "You are a market research analyst. You frame where a feature/idea sits in its market and the trends shaping it.",
    task: `Produce sections: Market Context, Key Trends (bullets), Demand Signals (bullets), Where This Fits, Recommended Positioning. Add a note that live web retrieval with citations is the next maturity step.`,
  },
  competitive: {
    system:
      "You are a competitive intelligence analyst. You compare how others approach a capability and find differentiation.",
    task: `Produce sections: Competitive Landscape, Comparison (use a table with columns ["Player","Approach","Strength","Gap"]), Differentiation Opportunities (bullets), Watch-outs (bullets).`,
  },
  feedback: {
    system:
      "You are a user-research analyst. You synthesize what users typically say about a class of feature into themes and sentiment.",
    task: `Produce sections: What Users Care About (bullets), Common Complaints (bullets), Delight Drivers (bullets), Sentiment Summary. Add a note that ingesting real reviews/tickets/surveys is the next maturity step.`,
  },
  process: {
    system:
      "You are a process and domain analyst. You map how a feature touches real workflows, systems, roles, and constraints. When relevant, use payer/health-plan domain knowledge.",
    task: `Produce sections: Impacted Workflows (bullets), Systems & Integrations (bullets), Roles & Handoffs (bullets), Domain Constraints (bullets), Automation Opportunities (bullets).`,
  },
  defects: {
    system:
      "You are a QA / reliability lead. You anticipate how a feature will fail in production before it ships.",
    task: `Produce sections: Likely Defect Areas (bullets), Failure Modes & Impact (use a table with columns ["Area","Failure mode","Member impact","Severity"]), Test Focus (bullets), Guardrails (bullets). Add a note that connecting to the live production platform is the advanced capability that will replace anticipation with real detection.`,
  },
  value_quant: {
    system:
      "You are a value-engineering analyst. You make business value tangible and quantifiable with a clear estimation template.",
    task: `Produce sections: Value Drivers (bullets), Quantified Impact (use a table with columns ["Metric","Baseline","Target","Est. annual value","How to measure"]), Assumptions (bullets), How to Validate (bullets). Keep numbers as clearly-labeled illustrative placeholders unless the input provides real figures.`,
  },
  value_qual: {
    system:
      "You are a strategy analyst. You articulate real but hard-to-quantify value.",
    task: `Produce sections: Strategic Value (bullets), Member/User Experience Value (bullets), Risk & Compliance Value (bullets), Narrative (a short paragraph a leader could use).`,
  },
};

export async function runCapability(
  capabilityId: string,
  input: AnalyzeInput
): Promise<CapabilityOutput> {
  const meta = getCapability(capabilityId);
  const def = DEFS[capabilityId];
  if (!meta || !def) throw new Error(`Unknown capability: ${capabilityId}`);

  const provider = await getProvider();

  if (provider.mode === "demo") {
    return hydrateSeed(capabilityId, input);
  }

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
