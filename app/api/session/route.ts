import { NextResponse } from "next/server";
import { RESEARCH_CAPABILITIES } from "@/lib/orchestrator/catalog/research";
import { buildPlan, classifyInput } from "@/lib/orchestrator/plan";
import { emptyStream } from "@/lib/orchestrator/research";
import { listSessions, newSessionId, saveSession } from "@/lib/orchestrator/store";
import type { InputType, ResearchStream, Session } from "@/lib/orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: InputType[] = [
  "auto", "problem", "question", "idea", "solution", "requirement", "decision", "transcript", "data",
];

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      input: s.input,
      inputType: s.inputType,
      objective: s.plan.objective,
      stage: s.stage,
      updatedAt: s.updatedAt,
    })),
  });
}

/**
 * POST /api/session — the front door.
 * Reads the product question, then returns the recommended package (Step 10).
 * Nothing runs yet; the PM accepts or edits the plan first.
 */
export async function POST(req: Request) {
  let body: { input?: string; inputType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const input = (body.input || "").trim();
  if (!input) return NextResponse.json({ error: "Describe the product question first." }, { status: 400 });

  const requested = TYPES.includes(body.inputType as InputType) ? (body.inputType as InputType) : "auto";
  const detected = await classifyInput(input);
  const inputType = requested === "auto" ? detected : requested;

  const plan = await buildPlan({ input, inputType });
  const chosen = new Set(plan.research.filter((r) => r.selected).map((r) => r.id));
  const streams: ResearchStream[] = RESEARCH_CAPABILITIES.map((c) => emptyStream(c.id, chosen.has(c.id)));

  const now = Date.now();
  const session: Session = {
    id: newSessionId(),
    input,
    inputType,
    detectedType: detected,
    plan,
    stage: "plan",
    streams,
    analyses: [],
    artifacts: [],
    notes: [],
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
    createdAt: now,
    updatedAt: now,
  };
  await saveSession(session);
  return NextResponse.json({ session });
}
