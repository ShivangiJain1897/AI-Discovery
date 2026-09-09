import { NextResponse } from "next/server";
import { ANALYSIS_METHODS, METHOD_FAMILIES } from "@/lib/orchestrator/catalog/analysis";
import { AUDIENCES, DEPTH_MODES } from "@/lib/orchestrator/catalog/depth";
import { OUTPUTS, OUTPUT_FAMILIES } from "@/lib/orchestrator/catalog/outputs";
import { RESEARCH_CAPABILITIES } from "@/lib/orchestrator/catalog/research";

export const runtime = "nodejs";

/** GET /api/catalog — everything the UI needs to render the four layers. */
export async function GET() {
  return NextResponse.json({
    research: RESEARCH_CAPABILITIES.map(({ id, letter, name, icon, blurb, investigates, sources, research }) => ({
      id, letter, name, icon, blurb, investigates, sources, live: Boolean(research),
    })),
    methodFamilies: METHOD_FAMILIES.map(({ id, name, blurb }) => ({ id, name, blurb })),
    methods: ANALYSIS_METHODS.map(({ id, name, familyId, blurb, method, evidenceNeeded }) => ({
      id, name, familyId, blurb, method, evidenceNeeded,
    })),
    outputFamilies: OUTPUT_FAMILIES.map(({ id, name, blurb, icon }) => ({ id, name, blurb, icon })),
    outputs: OUTPUTS.map(({ id, name, familyId, blurb, needs }) => ({ id, name, familyId, blurb, needs })),
    depths: DEPTH_MODES.map(({ id, name, blurb }) => ({ id, name, blurb })),
    audiences: AUDIENCES.map(({ id, name }) => ({ id, name })),
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
}
