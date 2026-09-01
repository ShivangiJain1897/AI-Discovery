import { NextResponse } from "next/server";
import { generate } from "@/lib/workflow/generate";
import { getWorkflow, saveWorkflow } from "@/lib/workflow/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/workflow/:id/generate — { kind: "prd" | "backlog" } from validated findings. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await getWorkflow(id);
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let kind: "prd" | "backlog" = "prd";
  try {
    const b = await req.json();
    if (b?.kind === "backlog") kind = "backlog";
  } catch {
    /* default prd */
  }

  const output = await generate(w, kind);
  w.outputs = [output, ...w.outputs];
  w.stage = "generate";
  await saveWorkflow(w);
  return NextResponse.json({ workflow: w, output });
}
