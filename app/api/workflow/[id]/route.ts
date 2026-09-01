import { NextResponse } from "next/server";
import { deleteWorkflow, getWorkflow, saveWorkflow } from "@/lib/workflow/store";
import type { InputType, Stage, Verdict, Workflow } from "@/lib/workflow/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await getWorkflow(id);
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ workflow: w });
}

/**
 * PATCH /api/workflow/:id — small human-in-the-loop updates:
 *  { inputType } · { stage } · { agentId, fields:[{id,value}] } (intake)
 *  { agentId, findingId, verdict } · { agentId, userNotes }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await getWorkflow(id);
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let b: {
    inputType?: InputType;
    stage?: Stage;
    agentId?: string;
    fields?: { id: string; value: string }[];
    findingId?: string;
    verdict?: Verdict;
    userNotes?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (b.inputType) w.inputType = b.inputType;
  if (b.stage) w.stage = b.stage;

  const agent = b.agentId ? w.agents.find((a) => a.agentId === b.agentId) : undefined;
  if (agent) {
    if (Array.isArray(b.fields)) {
      for (const f of b.fields) {
        const field = agent.intake.find((x) => x.id === f.id);
        if (field) {
          field.value = String(f.value ?? "");
          field.captured = false; // user-provided now
        }
      }
    }
    if (b.findingId && b.verdict !== undefined) {
      const fnd = agent.findings.find((x) => x.id === b.findingId);
      if (fnd) fnd.verdict = b.verdict;
    }
    if (typeof b.userNotes === "string") agent.userNotes = b.userNotes;
  }

  await saveWorkflow(w as Workflow);
  return NextResponse.json({ workflow: w });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getWorkflow(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteWorkflow(id);
  return NextResponse.json({ ok: true });
}
