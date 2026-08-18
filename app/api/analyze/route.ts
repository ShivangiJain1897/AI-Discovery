import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/capabilities/analyze";
import { CAPABILITIES } from "@/lib/capabilities/registry";
import type { AnalyzeSession, InputType } from "@/lib/capabilities/types";
import { listSessions, newSessionId, saveSession } from "@/lib/store";
import { getUseCase, saveUseCase } from "@/lib/intake/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CAPS = new Set(CAPABILITIES.map((c) => c.id));
const VALID_TYPES = new Set<InputType>(["auto", "feature", "requirement", "transcript"]);

/** GET /api/analyze — list sessions. */
export async function GET() {
  return NextResponse.json({ sessions: await listSessions() });
}

/** POST /api/analyze — run selected capabilities against pasted input. */
export async function POST(req: Request) {
  let body: {
    text?: string;
    inputType?: string;
    productContext?: string;
    capabilityIds?: string[];
    linkedUseCaseId?: string;
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

  const session: AnalyzeSession = {
    id: newSessionId(),
    input: {
      text,
      inputType,
      productContext: typeof body.productContext === "string" ? body.productContext.trim() : undefined,
    },
    capabilityIds,
    status: "queued",
    mode: "demo",
    createdAt: Date.now(),
    runs: [],
    linkedUseCaseId: typeof body.linkedUseCaseId === "string" ? body.linkedUseCaseId : undefined,
  };
  await saveSession(session);

  // Link this discovery back to the intake use case it came from, if any.
  if (session.linkedUseCaseId) {
    const uc = await getUseCase(session.linkedUseCaseId);
    if (uc) {
      uc.discoverySessionIds = [...(uc.discoverySessionIds ?? []), session.id];
      uc.updatedAt = Date.now();
      await saveUseCase(uc);
    }
  }

  try {
    await runAnalysis(session, saveSession);
  } catch (err) {
    session.status = "error";
    session.finishedAt = Date.now();
    await saveSession(session);
    return NextResponse.json(
      { session, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  await saveSession(session);
  return NextResponse.json({ session });
}
