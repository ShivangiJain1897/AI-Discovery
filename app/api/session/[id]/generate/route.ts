import { NextResponse } from "next/server";
import { AUDIENCES, DEPTH_MODES } from "@/lib/orchestrator/catalog/depth";
import { getOutput } from "@/lib/orchestrator/catalog/outputs";
import { generateArtifact } from "@/lib/orchestrator/generate";
import { getSession, saveSession } from "@/lib/orchestrator/store";
import type { AudienceId, DepthMode } from "@/lib/orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/session/:id/generate — produce an artifact from the session dossier.
 * Body: { outputId, depth?, audience? }. Generating a second format never
 * re-runs research.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let outputId = "";
  let depth: DepthMode | undefined;
  let audience: AudienceId | undefined;
  try {
    const b = await req.json();
    outputId = String(b?.outputId ?? "");
    if (DEPTH_MODES.some((d) => d.id === b?.depth)) depth = b.depth as DepthMode;
    if (AUDIENCES.some((a) => a.id === b?.audience)) audience = b.audience as AudienceId;
  } catch {
    /* validated below */
  }
  if (!getOutput(outputId)) return NextResponse.json({ error: "Unknown output requested." }, { status: 400 });

  const artifact = await generateArtifact(s, outputId, { depth, audience });
  s.artifacts = [...s.artifacts, artifact];
  s.stage = "generate";
  await saveSession(s);
  return NextResponse.json({ session: s, artifact });
}
