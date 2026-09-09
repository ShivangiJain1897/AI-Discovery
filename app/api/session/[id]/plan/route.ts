import { NextResponse } from "next/server";
import { getMethod } from "@/lib/orchestrator/catalog/analysis";
import { AUDIENCES, DEPTH_MODES } from "@/lib/orchestrator/catalog/depth";
import { getOutput } from "@/lib/orchestrator/catalog/outputs";
import { getCapability } from "@/lib/orchestrator/catalog/research";
import { buildPlan } from "@/lib/orchestrator/plan";
import { getSession, saveSession } from "@/lib/orchestrator/store";
import type { AudienceId, DepthMode, PlanItem } from "@/lib/orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/session/:id/plan — the PM shaping the recommended package.
 *
 * Body (all optional):
 *   { research: string[] }            the capability ids to run
 *   { analysis: string[] }            the analysis method ids to apply
 *   { outputs: string[] }             the artifacts wanted
 *   { depth, audience }
 *   { answers: { id, answer }[] }     answers to clarifying questions
 *   { replan: true }                  re-plan from the answers just given
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let b: {
    research?: string[];
    analysis?: string[];
    outputs?: string[];
    depth?: string;
    audience?: string;
    answers?: { id: string; answer: string }[];
    replan?: boolean;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (Array.isArray(b.answers)) {
    for (const a of b.answers) {
      const q = s.plan.clarifications.find((c) => c.id === a.id);
      if (q) q.answer = String(a.answer ?? "").trim();
    }
  }

  // Re-plan keeps the PM's answers and assumptions but rebuilds the package
  // around them — the answers are exactly the information that should change it.
  if (b.replan) {
    const answered = s.plan.clarifications.filter((c) => c.answer.trim());
    const enriched = answered.length
      ? `${s.input}\n\nThe PM has since clarified:\n${answered.map((c) => `- ${c.question} ${c.answer}`).join("\n")}`
      : s.input;
    const fresh = await buildPlan({ input: enriched, inputType: s.inputType });
    // Answered questions are settled; don't resurrect them.
    fresh.clarifications = fresh.clarifications.filter(
      (c) => !answered.some((a) => a.question.toLowerCase() === c.question.toLowerCase())
    );
    s.plan = { ...fresh, clarifications: [...answered, ...fresh.clarifications] };
  }

  // Selecting an item the orchestrator didn't recommend is legitimate — the PM
  // knows things the request didn't say — so unknown-but-valid ids are added.
  const applySelection = (
    current: PlanItem[],
    wanted: string[] | undefined,
    valid: (id: string) => boolean,
    addedWhy: string
  ): PlanItem[] => {
    if (!Array.isArray(wanted)) return current;
    const set = new Set(wanted.filter(valid));
    const next = current.map((item) => ({ ...item, selected: set.has(item.id) }));
    for (const wid of set) {
      if (!next.some((i) => i.id === wid)) {
        next.push({ id: wid, required: false, why: addedWhy, selected: true });
      }
    }
    return next;
  };

  s.plan.research = applySelection(s.plan.research, b.research, (x) => Boolean(getCapability(x)), "Added by the product manager.");
  s.plan.analysis = applySelection(s.plan.analysis, b.analysis, (x) => Boolean(getMethod(x)), "Added by the product manager.");
  s.plan.outputs = applySelection(s.plan.outputs, b.outputs, (x) => Boolean(getOutput(x)), "Added by the product manager.");

  if (DEPTH_MODES.some((d) => d.id === b.depth)) s.plan.depth = b.depth as DepthMode;
  if (AUDIENCES.some((a) => a.id === b.audience)) s.plan.audience = b.audience as AudienceId;

  // Keep the streams in sync with the plan.
  // Deselecting a lens does not discard evidence it already produced — reselect
  // it and the findings are still there.
  const chosen = new Set(s.plan.research.filter((r) => r.selected).map((r) => r.id));
  for (const stream of s.streams) stream.selected = chosen.has(stream.capabilityId);

  await saveSession(s);
  return NextResponse.json({ session: s });
}
