import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/orchestrator/store";
import { synthesize } from "@/lib/orchestrator/synthesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/session/:id/synthesis — synthesize ACROSS the streams (Steps 5-6). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!s.streams.some((x) => x.selected && x.status === "complete")) {
    return NextResponse.json({ error: "Run the research streams first — there is nothing to synthesize." }, { status: 400 });
  }

  s.synthesis = await synthesize(s);
  s.stage = "synthesis";
  await saveSession(s);
  return NextResponse.json({ session: s });
}
