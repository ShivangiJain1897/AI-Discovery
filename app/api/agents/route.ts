import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents/registry";
import { MEMBER_VALUE_CHAIN, KPIS, PERSONAS } from "@/lib/domain/member-value-chain";

export const runtime = "nodejs";

/** GET /api/agents — agent registry + domain model, for the dashboard. */
export async function GET() {
  return NextResponse.json({
    agents: AGENTS,
    valueChain: MEMBER_VALUE_CHAIN,
    kpis: KPIS,
    personas: PERSONAS,
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
}
