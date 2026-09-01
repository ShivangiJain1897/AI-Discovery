import { NextResponse } from "next/server";
import { runAgent } from "@/lib/workflow/agents";
import { getWorkflow, saveWorkflow } from "@/lib/workflow/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workflow/:id/run — run the selected agents with their intake and
 * produce findings. Body: { agentIds?: string[] } to run a subset.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await getWorkflow(id);
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let subset: Set<string> | null = null;
  try {
    const b = await req.json();
    if (Array.isArray(b?.agentIds) && b.agentIds.length) subset = new Set(b.agentIds);
  } catch {
    /* run all selected */
  }

  const toRun = w.agents.filter((a) => a.selected && (!subset || subset.has(a.agentId)));
  if (toRun.length === 0) return NextResponse.json({ error: "No agents selected." }, { status: 400 });

  // Give every agent the shared business-context foundation as a preamble.
  const ctx = (w.context ?? []).filter((f) => f.value.trim());
  const preamble = ctx.length
    ? `BUSINESS CONTEXT:\n${ctx.map((f) => `- ${f.question} ${f.value}`).join("\n")}\n\n`
    : "";
  const groundedInput = preamble + w.input;

  await Promise.all(
    toRun.map(async (a) => {
      try {
        const { summary, findings } = await runAgent(a.agentId, groundedInput, a.intake);
        a.summary = summary;
        a.findings = findings;
        a.status = "complete";
        a.error = undefined;
      } catch (err) {
        a.status = "error";
        a.error = err instanceof Error ? err.message : String(err);
      }
    })
  );

  w.stage = "findings";
  await saveWorkflow(w);
  return NextResponse.json({ workflow: w });
}
