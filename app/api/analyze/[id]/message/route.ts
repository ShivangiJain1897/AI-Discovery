import { NextResponse } from "next/server";
import { buildHistory, runTurn } from "@/lib/capabilities/analyze";
import { CAPABILITIES } from "@/lib/capabilities/registry";
import type { ChatTurn } from "@/lib/capabilities/types";
import { getSession, saveSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CAPS = new Set(CAPABILITIES.map((c) => c.id));

/**
 * POST /api/analyze/:id/message — add a follow-up turn to a discovery thread.
 * Body: { text, capabilityIds }. Prior turns are passed as context.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  let body: { text?: string; capabilityIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  const capabilityIds = Array.isArray(body.capabilityIds)
    ? body.capabilityIds.filter((c) => VALID_CAPS.has(c))
    : [];
  if (capabilityIds.length === 0) return NextResponse.json({ error: "Pick at least one capability." }, { status: 400 });

  const turns = session.turns ?? [];
  const history = buildHistory(turns);
  session.status = "running";
  await saveSession(session);

  const runs = await runTurn(
    { text, inputType: session.input.inputType, productContext: session.input.productContext, history },
    capabilityIds
  );
  const turn: ChatTurn = { id: `t${turns.length + 1}`, userText: text, capabilityIds, runs, createdAt: Date.now() };
  session.turns = [...turns, turn];
  session.status = "complete";
  session.finishedAt = Date.now();
  await saveSession(session);

  return NextResponse.json({ session });
}
