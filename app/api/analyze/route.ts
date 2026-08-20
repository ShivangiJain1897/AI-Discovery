import { NextResponse } from "next/server";
import { currentMode, runTurn } from "@/lib/capabilities/analyze";
import { CAPABILITIES } from "@/lib/capabilities/registry";
import type { AnalyzeSession, ChatTurn, InputType } from "@/lib/capabilities/types";
import { listSessions, newSessionId, saveSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CAPS = new Set(CAPABILITIES.map((c) => c.id));
const VALID_TYPES = new Set<InputType>(["auto", "feature", "requirement", "transcript"]);

/** GET /api/analyze — list sessions (optionally ?product=<id>). */
export async function GET(req: Request) {
  const productId = new URL(req.url).searchParams.get("product");
  let sessions = await listSessions();
  if (productId) sessions = sessions.filter((s) => s.productId === productId);
  return NextResponse.json({ sessions });
}

/** POST /api/analyze — run selected capabilities against pasted input. */
export async function POST(req: Request) {
  let body: {
    text?: string;
    inputType?: string;
    productContext?: string;
    capabilityIds?: string[];
    productId?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // fall through to validation
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Please paste some input text." }, { status: 400 });
  }
  const capabilityIds = Array.isArray(body.capabilityIds)
    ? body.capabilityIds.filter((id) => VALID_CAPS.has(id))
    : [];
  if (capabilityIds.length === 0) {
    return NextResponse.json({ error: "Pick at least one capability." }, { status: 400 });
  }
  const inputType =
    typeof body.inputType === "string" && VALID_TYPES.has(body.inputType as InputType)
      ? (body.inputType as InputType)
      : "auto";

  const productContext = typeof body.productContext === "string" ? body.productContext.trim() : undefined;
  const mode = await currentMode();

  const session: AnalyzeSession = {
    id: newSessionId(),
    input: { text, inputType, productContext },
    turns: [],
    status: "running",
    mode,
    productId: typeof body.productId === "string" ? body.productId : undefined,
    createdAt: Date.now(),
  };
  await saveSession(session);

  try {
    const runs = await runTurn({ text, inputType, productContext }, capabilityIds);
    const turn: ChatTurn = { id: "t1", userText: text, capabilityIds, runs, createdAt: Date.now() };
    session.turns = [turn];
    session.status = runs.some((r) => r.status === "complete") ? "complete" : "error";
  } catch (err) {
    session.status = "error";
    session.finishedAt = Date.now();
    await saveSession(session);
    return NextResponse.json(
      { session, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  session.finishedAt = Date.now();
  await saveSession(session);
  return NextResponse.json({ session });
}
