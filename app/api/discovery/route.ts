import { NextResponse } from "next/server";
import { DEFAULT_LENSES, getLens } from "@/lib/discovery/lenses";
import { emptyLens, readIdea, runLens, summarize } from "@/lib/discovery/run";
import { listDiscoveries, newDiscoveryId, saveDiscovery } from "@/lib/discovery/store";
import type { Discovery, Kind, LensId } from "@/lib/discovery/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const all = await listDiscoveries();
  return NextResponse.json({
    discoveries: all.map((d) => ({ id: d.id, idea: d.idea, kind: d.kind, updatedAt: d.updatedAt })),
  });
}

/**
 * POST /api/discovery — the only thing the user has to do.
 * Reads the idea, runs every chosen lens in parallel, and summarizes. One call.
 */
export async function POST(req: Request) {
  let body: { idea?: string; kind?: string; lenses?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const idea = (body.idea || "").trim();
  if (!idea) return NextResponse.json({ error: "Describe what you want to discover." }, { status: 400 });

  const kind: Kind = body.kind === "product" ? "product" : "feature";
  const chosen = (Array.isArray(body.lenses) ? body.lenses : DEFAULT_LENSES).filter((l) => getLens(l)) as LensId[];
  if (chosen.length === 0) return NextResponse.json({ error: "Pick at least one thing to research." }, { status: 400 });

  const context = await readIdea(idea, kind);

  const lenses = chosen.map((id) => emptyLens(id));
  await Promise.all(
    lenses.map(async (l) => {
      try {
        Object.assign(l, await runLens(l.lensId, idea, kind, context, []), { status: "done" as const });
      } catch (err) {
        l.status = "error";
        l.error = err instanceof Error ? err.message : String(err);
      }
    })
  );

  const summary = await summarize(idea, kind, context, lenses, []);

  const now = Date.now();
  const discovery: Discovery = {
    id: newDiscoveryId(),
    idea,
    kind,
    context,
    lenses,
    summary,
    documents: [],
    notes: [],
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
    createdAt: now,
    updatedAt: now,
  };
  await saveDiscovery(discovery);
  return NextResponse.json({ discovery });
}
