/**
 * Running a discovery: understand the idea → research it → summarize.
 *
 * All of it happens in one go when the user hits Discover. There is no plan to
 * approve and no stages to drive — the point is that it just runs.
 */
import { getProvider } from "../llm/provider";
import { getLens, type Lens } from "./lenses";
import type { Confidence, Context, Finding, Kind, LensId, LensResult, Summary } from "./types";

const CONFIDENCES: Confidence[] = ["High", "Medium", "Low"];

/* ------------------------------- context --------------------------------- */

/** Work out what the idea is actually about, before researching it. */
export async function readIdea(idea: string, kind: Kind): Promise<Context> {
  const provider = await getProvider();
  if (provider.mode === "live") {
    try {
      const raw = await provider.generateJson<Partial<Context>>({
        system:
          "You read a product idea and state plainly what it's about. You infer sensibly from what's written and don't pad. Keep each field to one short sentence.",
        prompt: `A product manager wants to discover this ${kind}:
"""
${idea.slice(0, 4000)}
"""

Return JSON:
{
  "industry": "the industry or domain this sits in",
  "users": "who this is for",
  "problem": "the underlying problem, stated plainly — if the idea names a solution, say what problem it's solving",
  "goal": "what success would look like"
}`,
        maxTokens: 500,
      });
      return {
        industry: clean(raw?.industry) || guessIndustry(idea),
        users: clean(raw?.users) || "Not stated — worth confirming",
        problem: clean(raw?.problem) || firstLine(idea),
        goal: clean(raw?.goal) || "Not stated — worth confirming",
      };
    } catch {
      /* fall through */
    }
  }
  return {
    industry: guessIndustry(idea),
    users: "Not stated — worth confirming",
    problem: firstLine(idea),
    goal: "Not stated — worth confirming",
  };
}

function guessIndustry(idea: string): string {
  const t = idea.toLowerCase();
  if (/payer|member|health|insur|claim|medicare|patient|clinical|pharmacy/.test(t)) return "Healthcare";
  if (/bank|payment|fintech|loan|credit|invoice|billing/.test(t)) return "Financial services";
  if (/shop|retail|ecommerce|cart|checkout|store/.test(t)) return "Retail & e-commerce";
  if (/school|student|course|learn|teach/.test(t)) return "Education";
  if (/logistic|shipping|fleet|warehouse|supply/.test(t)) return "Logistics & supply chain";
  return "General software";
}
function firstLine(s: string): string {
  const l = s.trim().replace(/\s+/g, " ");
  return l.length > 200 ? l.slice(0, 197) + "…" : l;
}
function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/* -------------------------------- lenses --------------------------------- */

export function emptyLens(id: LensId): LensResult {
  return { lensId: id, status: "pending", summary: "", findings: [], gaps: [], sources: [] };
}

/** Run one lens. Returns its findings, or an honest empty result. */
export async function runLens(
  lensId: LensId,
  idea: string,
  kind: Kind,
  context: Context,
  notes: string[]
): Promise<Omit<LensResult, "lensId" | "status">> {
  const lens = getLens(lensId);
  if (!lens) throw new Error(`Unknown lens: ${lensId}`);
  const provider = await getProvider();
  if (provider.mode === "live") return live(lens, idea, kind, context, notes);
  return demo(lens);
}

function brief(idea: string, kind: Kind, context: Context, notes: string[]): string {
  return [
    `THE ${kind.toUpperCase()} BEING DISCOVERED:`,
    `"""\n${idea.slice(0, 5000)}\n"""`,
    ``,
    `WHAT WE UNDERSTAND SO FAR:`,
    `- Industry: ${context.industry}`,
    `- Users: ${context.users}`,
    `- Problem: ${context.problem}`,
    `- Goal: ${context.goal}`,
    notes.length ? `\nEXTRA CONTEXT FROM THE PRODUCT MANAGER:\n${notes.map((n) => `- ${n}`).join("\n")}` : "",
  ].join("\n");
}

async function live(
  lens: Lens,
  idea: string,
  kind: Kind,
  context: Context,
  notes: string[]
): Promise<Omit<LensResult, "lensId" | "status">> {
  const provider = await getProvider();
  const sources: string[] = [];

  let research = "";
  if (lens.web && typeof provider.research === "function") {
    try {
      const found = await provider.research(webQuery(lens, idea, context));
      if (found?.trim()) {
        research = `\n\nWEB RESEARCH (ground your factual claims in this and cite it — anything not here is not a fact):\n${found.trim()}\n`;
        for (const m of found.matchAll(/https?:\/\/[^\s)\]]+/g)) sources.push(m[0]);
      }
    } catch {
      /* best effort */
    }
  }

  const raw = await provider.generateJson<{
    summary?: string;
    findings?: { title?: string; detail?: string; confidence?: string; basis?: string }[];
    gaps?: string[];
  }>({
    system: lens.system,
    prompt: `${brief(idea, kind, context, notes)}${research}

Report what you found. Return JSON:
{
  "summary": "two or three sentences: what this lens shows and how solid it is",
  "findings": [ { "title": "short and specific", "detail": "what it means and what follows from it", "confidence": "High|Medium|Low", "basis": "what this rests on — a source, or what would confirm it" } ],
  "gaps": ["what you couldn't establish, and how we'd find out"]
}

Give 3 to 5 findings. Only mark a finding "High" if you can point to something concrete. If you're reasoning from experience rather than evidence about this specific case, that's "Low" and the basis should say so — that's a useful, honest answer, not a failure.`,
    maxTokens: 2200,
  });

  return {
    summary: clean(raw?.summary),
    findings: (raw?.findings ?? [])
      .filter((f) => clean(f?.title))
      .map((f, i) => ({
        id: `f${i + 1}`,
        title: clean(f.title).slice(0, 180),
        detail: clean(f.detail),
        confidence: CONFIDENCES.find((c) => c.toLowerCase() === clean(f.confidence).toLowerCase()) ?? "Low",
        basis: clean(f.basis) || "Not stated",
      })),
    gaps: list(raw?.gaps),
    sources: [...new Set(sources)].slice(0, 10),
  };
}

function webQuery(lens: Lens, idea: string, context: Context): string {
  const topic = `${idea.replace(/\s+/g, " ").slice(0, 500)} (industry: ${context.industry}; users: ${context.users})`;
  if (lens.id === "market") {
    return `For this product idea, find: the market category and its growth, the specific competing products and companies, and the manual alternatives people use instead. Include pricing where published. Cite every source with its date.\n\nIDEA: ${topic}`;
  }
  if (lens.id === "compliance") {
    return `For this product idea, find the specific regulations, standards and privacy/security/accessibility obligations that apply, by name and jurisdiction. Cite the regulator or standards body.\n\nIDEA: ${topic}`;
  }
  return `Find current, factual, sourced context relevant to: ${topic}`;
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 8) : [];
}

/**
 * Demo mode. These are illustrative patterns, not research into this idea —
 * everything is marked Low confidence and the basis says so explicitly, and the
 * UI carries a demo banner. Nothing here is presented as a fact about the user's
 * specific idea.
 */
function demo(lens: Lens): Omit<LensResult, "lensId" | "status"> {
  return {
    summary: `Demo mode — this is what the ${lens.name.toLowerCase()} lens looks at, shown with illustrative patterns rather than research into your idea. Add an API key for real findings.`,
    findings: lens.demo.map((d, i) => ({
      id: `f${i + 1}`,
      title: d.title,
      detail: d.detail,
      confidence: "Low" as Confidence,
      basis: "Demo mode — a general pattern, not researched for your idea.",
    })),
    gaps: [`Everything above needs checking against your actual ${lens.name.toLowerCase()} evidence.`],
    sources: [],
  };
}

/* ------------------------------- summary --------------------------------- */

/** Pull the lenses together into something readable in 30 seconds. */
export async function summarize(
  idea: string,
  kind: Kind,
  context: Context,
  lenses: LensResult[],
  notes: string[]
): Promise<Summary> {
  const done = lenses.filter((l) => l.status === "done" && l.findings.length > 0);
  const provider = await getProvider();

  if (provider.mode === "live" && done.length > 0) {
    try {
      const blocks = done
        .map((l) => {
          const name = getLens(l.lensId)?.name ?? l.lensId;
          const fs = l.findings.map((f) => `- [${f.confidence}] ${f.title}: ${f.detail}`).join("\n");
          return `## ${name}\n${l.summary}\n${fs}${l.gaps.length ? `\nGaps: ${l.gaps.join(" | ")}` : ""}`;
        })
        .join("\n\n");

      const raw = await provider.generateJson<Partial<Summary>>({
        system: `You pull several research lenses together for a product manager.

Your job is to find what's only visible ACROSS the lenses — a complaint that the process analysis explains, a market opening the user research supports, a feasibility problem that undercuts the whole idea. Don't summarize each lens in turn; that work is already done and repeating it is useless.

Be direct. If the research points against the idea, say so. If a conclusion rests on thin evidence, say that too. Never invent anything.`,
        prompt: `THE ${kind.toUpperCase()}: ${idea.slice(0, 2000)}
Problem: ${context.problem}
${notes.length ? `\nThe PM added: ${notes.join(" | ")}\n` : ""}
WHAT THE LENSES FOUND:

${blocks}

Return JSON:
{
  "headline": "the single most important thing to know, in one sentence",
  "learned": ["3-5 things we now know, each connecting more than one lens where possible"],
  "opportunities": ["2-4 specific things worth doing, not themes"],
  "risks": ["2-4 things that could sink this, or that we need to check first"]
}`,
        maxTokens: 1600,
      });

      const s: Summary = {
        headline: clean(raw?.headline),
        learned: list(raw?.learned),
        opportunities: list(raw?.opportunities),
        risks: list(raw?.risks),
      };
      if (s.headline) return s;
    } catch {
      /* fall through */
    }
  }
  return fallbackSummary(done, provider.mode === "demo");
}

function fallbackSummary(done: LensResult[], isDemo: boolean): Summary {
  if (done.length === 0) {
    return {
      headline: "No research has completed yet.",
      learned: [],
      opportunities: [],
      risks: [],
    };
  }
  const top = done.flatMap((l) => l.findings.slice(0, 2)).map((f) => f.title);
  return {
    headline: isDemo
      ? `Demo mode — ${done.length} lens${done.length === 1 ? "" : "es"} ran with illustrative patterns rather than research into your idea.`
      : `${done.length} lens${done.length === 1 ? "" : "es"} reported; treat the findings below as provisional until checked.`,
    learned: top.slice(0, 5),
    opportunities: [],
    risks: done.flatMap((l) => l.gaps).slice(0, 4),
  };
}
