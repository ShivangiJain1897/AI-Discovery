import { NextResponse } from "next/server";
import { decide } from "@/lib/orchestrator/decision";
import { getSession, saveSession } from "@/lib/orchestrator/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/session/:id/decision — Evidence → Options → Recommendation (Step 7). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  s.decision = await decide(s);
  s.stage = "decision";
  await saveSession(s);
  return NextResponse.json({ session: s, decision: s.decision });
}
