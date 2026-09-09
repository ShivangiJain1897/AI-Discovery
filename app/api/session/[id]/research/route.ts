import { NextResponse } from "next/server";
import { briefFor, runStream } from "@/lib/orchestrator/research";
import { getSession, saveSession } from "@/lib/orchestrator/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/session/:id/research — run the selected capabilities as PARALLEL
 * evidence streams. Body: { capabilityIds?: string[] } to re-run a subset.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let subset: Set<string> | null = null;
  try {
    const b = await req.json();
    if (Array.isArray(b?.capabilityIds) && b.capabilityIds.length) subset = new Set(b.capabilityIds);
  } catch {
    /* run everything selected */
  }

  const toRun = s.streams.filter((x) => x.selected && (!subset || subset.has(x.capabilityId)));
  if (toRun.length === 0) {
    return NextResponse.json({ error: "No research capabilities are selected." }, { status: 400 });
  }

  const brief = briefFor(s.plan, s.input, s.notes);

  await Promise.all(
    toRun.map(async (stream) => {
      stream.status = "running";
      try {
        const result = await runStream(stream.capabilityId, brief, s.plan.depth, stream.userNotes);
        Object.assign(stream, result, { status: "complete" as const, error: undefined });
      } catch (err) {
        stream.status = "error";
        stream.error = err instanceof Error ? err.message : String(err);
      }
    })
  );

  // New evidence invalidates the synthesis built on the old evidence.
  s.synthesis = undefined;
  s.stage = "research";
  await saveSession(s);
  return NextResponse.json({ session: s });
}
