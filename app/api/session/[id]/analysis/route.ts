import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/orchestrator/analysis";
import { getMethod } from "@/lib/orchestrator/catalog/analysis";
import { getSession, saveSession } from "@/lib/orchestrator/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/session/:id/analysis — apply analysis methods to the evidence
 * already gathered. Body: { methodIds?: string[] } — defaults to the plan's
 * selected methods. Never triggers new research.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let ids: string[] = s.plan.analysis.filter((m) => m.selected).map((m) => m.id);
  try {
    const b = await req.json();
    if (Array.isArray(b?.methodIds) && b.methodIds.length) ids = b.methodIds.map(String);
  } catch {
    /* use the plan */
  }
  ids = ids.filter((x) => getMethod(x));
  if (ids.length === 0) return NextResponse.json({ error: "No analysis methods selected." }, { status: 400 });

  const runs = await Promise.all(ids.map((methodId) => runAnalysis(s, methodId)));
  // Re-running a method replaces its previous result rather than stacking
  // near-duplicates in the thread.
  const replaced = new Set(ids);
  s.analyses = [...s.analyses.filter((a) => !replaced.has(a.methodId)), ...runs];
  s.stage = "analysis";
  await saveSession(s);
  return NextResponse.json({ session: s, runs });
}
