import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/workflow/agents";
import { ANALYSIS_FRAMEWORKS } from "@/lib/workflow/analysis";

export const runtime = "nodejs";

/** GET /api/agents — research agents + analysis frameworks catalog + mode. */
export async function GET() {
  return NextResponse.json({
    agents: AGENTS.map(({ id, name, icon, blurb, questions }) => ({ id, name, icon, blurb, questions })),
    frameworks: ANALYSIS_FRAMEWORKS.map(({ id, name, blurb, method }) => ({ id, name, blurb, method })),
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
}
