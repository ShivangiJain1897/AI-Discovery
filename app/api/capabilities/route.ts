import { NextResponse } from "next/server";
import { CAPABILITIES, CATEGORY_ORDER } from "@/lib/capabilities/registry";

export const runtime = "nodejs";

/** GET /api/capabilities — capability catalog + current mode, for the composer. */
export async function GET() {
  return NextResponse.json({
    capabilities: CAPABILITIES,
    categoryOrder: CATEGORY_ORDER,
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
}
