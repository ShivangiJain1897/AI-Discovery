import { NextResponse } from "next/server";
import { listUseCases } from "@/lib/intake/store";
import { findSimilar } from "@/lib/intake/similarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/intake/similar — check a draft against existing use cases WITHOUT
 * saving. Powers the live "this looks similar to…" warning on the intake form.
 * Body: { title, problem, area?, tags?, excludeId? }
 */
export async function POST(req: Request) {
  let body: { title?: string; problem?: string; area?: string; tags?: string[]; excludeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const title = (body.title || "").trim();
  const problem = (body.problem || "").trim();
  if (!title && !problem) return NextResponse.json({ similar: [] });

  const existing = await listUseCases();
  const similar = findSimilar(
    { title, problem, area: body.area, tags: body.tags },
    existing,
    { excludeId: body.excludeId }
  );
  return NextResponse.json({ similar });
}
