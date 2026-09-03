import { NextResponse } from "next/server";
import { extractIntake } from "@/lib/workflow/agents";
import { getWorkflow, saveWorkflow } from "@/lib/workflow/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workflow/:id/select — set which agents are selected and auto-extract
 * each selected agent's intake from the input (captured vs still-needed).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await getWorkflow(id);
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let agentIds: string[] = [];
  try {
    const b = await req.json();
    agentIds = Array.isArray(b?.agentIds) ? b.agentIds : [];
  } catch {
    /* keep current selection */
    agentIds = w.agents.filter((a) => a.selected).map((a) => a.agentId);
  }
  const selected = new Set(agentIds);

  await Promise.all(
    w.agents.map(async (a) => {
      a.selected = selected.has(a.agentId);
      if (a.selected && a.intake.length === 0) {
        try {
          a.intake = await extractIntake(a.agentId, w.input, w.inputType);
          a.status = "intake";
        } catch (err) {
          a.status = "error";
          a.error = err instanceof Error ? err.message : String(err);
        }
      }
      if (!a.selected) {
        a.status = "pending";
      }
    })
  );

  w.stage = "intake";
  await saveWorkflow(w);
  return NextResponse.json({ workflow: w });
}
