import { NextResponse } from "next/server";
import { classifyInput, suggestAgents } from "@/lib/workflow/orchestrator";
import { AGENTS } from "@/lib/workflow/agents";
import { listWorkflows, newWorkflowId, saveWorkflow } from "@/lib/workflow/store";
import type { AgentState, InputType, Workflow } from "@/lib/workflow/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set<InputType>(["auto", "problem", "idea", "solution", "requirement", "transcript"]);

export async function GET() {
  return NextResponse.json({ workflows: await listWorkflows() });
}

/** POST /api/workflow — create a workflow; classify the input, suggest agents. */
export async function POST(req: Request) {
  let body: { input?: string; inputType?: string; agentIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const input = (body.input || "").trim();
  if (!input) return NextResponse.json({ error: "Say what you've got first." }, { status: 400 });

  const requested = TYPES.has(body.inputType as InputType) ? (body.inputType as InputType) : "auto";
  const detected = await classifyInput(input);
  const inputType = requested === "auto" ? detected : requested;

  const suggested = new Set(
    Array.isArray(body.agentIds) && body.agentIds.length ? body.agentIds : await suggestAgents(input)
  );

  const agents: AgentState[] = AGENTS.map((a) => ({
    agentId: a.id,
    selected: suggested.has(a.id),
    intake: [],
    status: "pending",
    findings: [],
  }));

  const now = Date.now();
  const wf: Workflow = {
    id: newWorkflowId(),
    input,
    inputType,
    detectedType: detected,
    stage: "framing",
    agents,
    outputs: [],
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
    createdAt: now,
    updatedAt: now,
  };
  await saveWorkflow(wf);
  return NextResponse.json({ workflow: wf });
}
