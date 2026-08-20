import { NextResponse } from "next/server";
import { PRODUCT_AGENTS } from "@/lib/product/agents";

export const runtime = "nodejs";

/** GET /api/product-agents — the catalog a product can enable, + mode. */
export async function GET() {
  return NextResponse.json({
    agents: PRODUCT_AGENTS,
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
}
