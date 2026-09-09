import { NextResponse } from "next/server";
import { getLens } from "@/lib/discovery/lenses";
import { emptyLens, runLens, summarize } from "@/lib/discovery/run";
import { getDiscovery, saveDiscovery } from "@/lib/discovery/store";
import type { LensId } from "@/lib/discovery/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/discovery/:id/rerun — research again, picking up any context the PM
 * added. Body: { lenses?: string[] } to change which lenses run.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiscovery(id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let wanted: LensId[] = d.lenses.map((l) => l.lensId);
  try {
    const b = await req.json();
    if (Array.isArray(b?.lenses) && b.lenses.length) {
      wanted = b.lenses.filter((l: string) => getLens(l)) as LensId[];
    }
  } catch {
    /* re-run what's already there */
  }
  if (wanted.length === 0) return NextResponse.json({ error: "Pick at least one thing to research." }, { status: 400 });

  const lenses = wanted.map((lid) => emptyLens(lid));
  await Promise.all(
    lenses.map(async (l) => {
      try {
        Object.assign(l, await runLens(l.lensId, d.idea, d.kind, d.context, d.notes), { status: "done" as const });
      } catch (err) {
        l.status = "error";
        l.error = err instanceof Error ? err.message : String(err);
      }
    })
  );

  d.lenses = lenses;
  d.summary = await summarize(d.idea, d.kind, d.context, lenses, d.notes);
  await saveDiscovery(d);
  return NextResponse.json({ discovery: d });
}
