import { NextResponse } from "next/server";
import { listPrompts } from "@/lib/capabilities/prompt-store";
import { CAPABILITIES } from "@/lib/capabilities/registry";
import { EXTRA_PROMPT_META } from "@/lib/capabilities/prompts";
import { storageMode } from "@/lib/storage/collection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/prompts — every capability with its effective + default prompt. */
export async function GET() {
  const prompts = await listPrompts();
  const meta = new Map(CAPABILITIES.map((c) => [c.id, c]));
  return NextResponse.json({
    prompts: prompts.map((p) => {
      const extra = EXTRA_PROMPT_META[p.capabilityId];
      return {
        ...p,
        name: meta.get(p.capabilityId)?.name ?? extra?.name ?? p.capabilityId,
        icon: meta.get(p.capabilityId)?.icon ?? extra?.icon ?? "✦",
        category: meta.get(p.capabilityId)?.category ?? extra?.category ?? "",
      };
    }),
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
    storage: storageMode(),
  });
}
