import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/workflow/agents";

export const runtime = "nodejs";

/** GET /api/agents — the agent catalog (without system prompts) + mode. */
export async function GET() {
  return NextResponse.json({
    agents: AGENTS.map(({ id, name, icon, blurb, questions }) => ({ id, name, icon, blurb, questions })),
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
}
