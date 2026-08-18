import { NextResponse } from "next/server";
import { getUseCase, saveUseCase } from "@/lib/intake/store";
import { runIntakeAnalysis } from "@/lib/intake/analysis";
import type { ScoreEntry } from "@/lib/intake/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/intake/:id/analyze — run (or refresh) the AI Intake Analyst.
 * Stores the provisional idea record and appends the AI score to the history.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uc = await getUseCase(id);
  if (!uc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const analysis = await runIntakeAnalysis(uc);
  uc.analysis = analysis;

  const entry: ScoreEntry = {
    at: Date.now(),
    stage: labelStage(uc.status),
    score: analysis.riceA.score,
    source: "ai",
    by: `AI (${analysis.mode})`,
    note: "Provisional RICE-A from current information",
  };
  uc.scoreHistory = [...(uc.scoreHistory ?? []), entry];
  uc.updatedAt = Date.now();
  await saveUseCase(uc);
  return NextResponse.json({ item: uc });
}

function labelStage(status: string): string {
  if (status === "new") return "Intake";
  if (status === "in_review") return "Triage";
  if (status === "in_discovery") return "Discovery";
  return status;
}
