import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/agents/orchestrator";
import type { DiscoveryRun } from "@/lib/agents/types";
import { listRuns, newRunId, saveRun } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/discovery — list all runs (most recent first). */
export async function GET() {
  return NextResponse.json({ runs: listRuns() });
}

/** POST /api/discovery — start a new discovery run and return the completed run. */
export async function POST(req: Request) {
  let focus = "";
  let appTarget = "";
  try {
    const body = await req.json();
    focus = typeof body?.focus === "string" ? body.focus : "";
    appTarget = typeof body?.appTarget === "string" ? body.appTarget : "";
  } catch {
    // empty body is fine
  }

  const run: DiscoveryRun = {
    id: newRunId(),
    valueChainId: "member",
    focus: focus || undefined,
    appTarget: appTarget || undefined,
    status: "queued",
    mode: "demo",
    createdAt: Date.now(),
    agentRuns: [],
    signals: [],
    opportunities: [],
  };
  saveRun(run);

  try {
    await runDiscovery(run, saveRun);
  } catch (err) {
    run.status = "error";
    run.finishedAt = Date.now();
    saveRun(run);
    return NextResponse.json(
      { run, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  saveRun(run);
  return NextResponse.json({ run });
}
