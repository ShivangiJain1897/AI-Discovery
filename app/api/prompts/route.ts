import { NextResponse } from "next/server";
import { listPrompts } from "@/lib/capabilities/prompt-store";
import { CAPABILITIES } from "@/lib/capabilities/registry";
import { storageMode } from "@/lib/storage/collection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/prompts — every capability with its effective + default prompt. */
export async function GET() {
  const prompts = await listPrompts();
  const meta = new Map(CAPABILITIES.map((c) => [c.id, c]));
  return NextResponse.json({
    prompts: prompts.map((p) => ({
      ...p,
      name: meta.get(p.capabilityId)?.name ?? p.capabilityId,
      icon: meta.get(p.capabilityId)?.icon ?? "✦",
      category: meta.get(p.capabilityId)?.category ?? "",
    })),
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
    storage: storageMode(),
  });
}
